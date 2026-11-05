-- =============================================================
-- 0002_ledger_functions.sql
-- Sổ cái, số dư, và các hàm ghi dữ liệu nguyên tử (giai đoạn 1 và 3)
-- Nguyên tắc:
--   * Mọi thay đổi số dư đi qua ledger_entries. Số dư không lưu cứng.
--   * transactions và ledger_entries không sửa, không xóa (trigger chặn).
--   * Sửa sai bằng bút toán đảo (reverse_transaction).
--   * Mỗi hàm ghi là một giao dịch cơ sở dữ liệu: thành công hết hoặc không gì cả.
-- =============================================================

-- ---------- Chặn sửa và xóa ----------
create or replace function prevent_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Bảng % không cho phép sửa hoặc xóa. Dùng bút toán đảo để sửa sai.', tg_table_name
    using errcode = 'P0001';
end;
$$;

create trigger transactions_no_mutation
  before update or delete on transactions
  for each row execute function prevent_mutation();

create trigger transactions_no_truncate
  before truncate on transactions
  for each statement execute function prevent_mutation();

create trigger ledger_entries_no_mutation
  before update or delete on ledger_entries
  for each row execute function prevent_mutation();

create trigger ledger_entries_no_truncate
  before truncate on ledger_entries
  for each statement execute function prevent_mutation();

create trigger audit_log_no_mutation
  before update or delete on audit_log
  for each row execute function prevent_mutation();

-- ---------- Kiểm tra hình dạng giao dịch khi commit ----------
-- Chạy ở cuối giao dịch (deferred), sau khi đã thêm đủ dòng sổ cái.
create or replace function check_transaction_shape(p_txn_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t           transactions%rowtype;
  n           int;
  s           numeric;
  neg_count   int;
  pos_count   int;
  wallet_cnt  int;
  ok          boolean := false;
  mismatch    boolean;
begin
  select * into t from transactions where id = p_txn_id;
  if not found then
    return;
  end if;

  select count(*),
         coalesce(sum(amount), 0),
         count(*) filter (where amount < 0),
         count(*) filter (where amount > 0),
         count(distinct wallet_id)
    into n, s, neg_count, pos_count, wallet_cnt
    from ledger_entries
   where transaction_id = p_txn_id;

  case t.txn_kind
    when 'income' then
      ok := n = 1 and pos_count = 1 and s = t.amount;
    when 'expense' then
      ok := n = 1 and neg_count = 1 and s = -t.amount;
    when 'transfer' then
      ok := n = 2 and wallet_cnt = 2
            and exists (select 1 from ledger_entries where transaction_id = p_txn_id and amount = t.amount)
            and exists (select 1 from ledger_entries where transaction_id = p_txn_id and amount = -t.amount);
    when 'adjustment' then
      ok := n = 1 and s <> 0 and abs(s) = t.amount
            and s = t.balance_after - t.balance_before;
    when 'reversal' then
      -- Dòng của bút toán đảo phải bằng đúng đảo dấu dòng của giao dịch gốc
      select exists (
        select 1 from (
          (select wallet_id, -amount as a from ledger_entries where transaction_id = t.reverses_id
             except all
           select wallet_id, amount from ledger_entries where transaction_id = p_txn_id)
          union all
          (select wallet_id, amount from ledger_entries where transaction_id = p_txn_id
             except all
           select wallet_id, -amount from ledger_entries where transaction_id = t.reverses_id)
        ) x
      ) into mismatch;
      ok := n > 0 and not mismatch;
    else
      ok := false;
  end case;

  if not ok then
    raise exception 'Giao dịch % (%) không hợp lệ: số dòng sổ cái không khớp với loại giao dịch',
      p_txn_id, t.txn_kind
      using errcode = '23514';
  end if;
end;
$$;

create or replace function trg_check_shape_from_txn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform check_transaction_shape(new.id);
  return null;
end;
$$;

create or replace function trg_check_shape_from_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform check_transaction_shape(new.transaction_id);
  return null;
end;
$$;

create constraint trigger transactions_shape_check
  after insert on transactions
  deferrable initially deferred
  for each row execute function trg_check_shape_from_txn();

create constraint trigger ledger_entries_shape_check
  after insert on ledger_entries
  deferrable initially deferred
  for each row execute function trg_check_shape_from_entry();

-- ---------- Số dư ví ----------
-- Số dư = số dư đầu ngày cắt + tổng dòng sổ cái từ ngày cắt trở đi.
-- Giao dịch lịch sử trước ngày cắt chỉ dùng cho báo cáo.
create or replace function wallet_balance(p_wallet_id uuid)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select w.opening_balance
       + coalesce((
           select sum(le.amount)
             from ledger_entries le
             join transactions t on t.id = le.transaction_id
            where le.wallet_id = w.id
              and t.txn_date >= w.opening_date
         ), 0)
    from wallets w
   where w.id = p_wallet_id;
$$;

-- ---------- Xác thực thành viên ----------
create or replace function is_family_member()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from family_members where auth_user_id = auth.uid()
  );
$$;

create or replace function current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from family_members where auth_user_id = auth.uid();
$$;

create or replace function assert_member()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m uuid;
begin
  m := current_member_id();
  if m is null then
    raise exception 'Tài khoản này chưa được liên kết với thành viên gia đình'
      using errcode = '42501';
  end if;
  return m;
end;
$$;

create or replace function assert_wallet_active(p_wallet_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from wallets where id = p_wallet_id and status = 'active') then
    raise exception 'Ví không tồn tại hoặc đã đóng' using errcode = '23503';
  end if;
end;
$$;

create or replace function assert_jar_active(p_jar_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from budget_jars where id = p_jar_id and is_active) then
    raise exception 'Lọ ngân sách không tồn tại hoặc đã tắt' using errcode = '23503';
  end if;
end;
$$;

-- ---------- Hàm ghi: thu nhập ----------
create or replace function post_income(
  p_date      date,
  p_amount    numeric,
  p_wallet_id uuid,
  p_category_id uuid default null,
  p_note      text default null,
  p_key       text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m   uuid;
  tid uuid;
begin
  m := assert_member();
  if p_key is not null then
    select id into tid from transactions where idempotency_key = p_key;
    if found then return tid; end if;
  end if;
  perform assert_wallet_active(p_wallet_id);
  if p_category_id is not null and not exists (
       select 1 from categories where id = p_category_id and txn_kind = 'income') then
    raise exception 'Danh mục không phải danh mục thu nhập' using errcode = '23514';
  end if;

  insert into transactions (txn_kind, txn_date, amount, category_id, note, idempotency_key,
                            paid_by_member_id, created_by)
  values ('income', p_date, p_amount, p_category_id, p_note, p_key, m, m)
  returning id into tid;

  insert into ledger_entries (transaction_id, wallet_id, amount)
  values (tid, p_wallet_id, p_amount);

  return tid;
end;
$$;

-- ---------- Hàm ghi: chi tiêu ----------
create or replace function post_expense(
  p_date        date,
  p_amount      numeric,
  p_wallet_id   uuid,
  p_jar_id      uuid,
  p_category_id uuid default null,
  p_paid_by     uuid default null,
  p_note        text default null,
  p_key         text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m   uuid;
  tid uuid;
begin
  m := assert_member();
  if p_key is not null then
    select id into tid from transactions where idempotency_key = p_key;
    if found then return tid; end if;
  end if;
  perform assert_wallet_active(p_wallet_id);
  perform assert_jar_active(p_jar_id);
  if p_category_id is not null and not exists (
       select 1 from categories
        where id = p_category_id and txn_kind = 'expense' and jar_id = p_jar_id) then
    raise exception 'Danh mục không thuộc lọ đã chọn' using errcode = '23514';
  end if;

  insert into transactions (txn_kind, txn_date, amount, jar_id, category_id, note,
                            idempotency_key, paid_by_member_id, created_by)
  values ('expense', p_date, p_amount, p_jar_id, p_category_id, p_note, p_key,
          coalesce(p_paid_by, m), m)
  returning id into tid;

  insert into ledger_entries (transaction_id, wallet_id, amount)
  values (tid, p_wallet_id, -p_amount);

  return tid;
end;
$$;

-- ---------- Hàm ghi: chuyển tiền giữa ví (nguyên tử) ----------
create or replace function post_transfer(
  p_date        date,
  p_amount      numeric,
  p_from_wallet uuid,
  p_to_wallet   uuid,
  p_note        text default null,
  p_key         text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m   uuid;
  tid uuid;
begin
  m := assert_member();
  if p_key is not null then
    select id into tid from transactions where idempotency_key = p_key;
    if found then return tid; end if;
  end if;
  if p_from_wallet = p_to_wallet then
    raise exception 'Ví nguồn và ví đích phải khác nhau' using errcode = '23514';
  end if;
  perform assert_wallet_active(p_from_wallet);
  perform assert_wallet_active(p_to_wallet);

  insert into transactions (txn_kind, txn_date, amount, note, idempotency_key, created_by)
  values ('transfer', p_date, p_amount, p_note, p_key, m)
  returning id into tid;

  insert into ledger_entries (transaction_id, wallet_id, amount) values
    (tid, p_from_wallet, -p_amount),
    (tid, p_to_wallet,   p_amount);

  return tid;
end;
$$;

-- ---------- Hàm ghi: điều chỉnh số dư đối soát ----------
-- Nhập số dư thực tế; hệ thống tính chênh lệch. Âm giảm, dương tăng.
create or replace function post_adjustment(
  p_wallet_id      uuid,
  p_actual_balance numeric,
  p_reason         text,
  p_date           date default current_date
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m      uuid;
  tid    uuid;
  before_bal numeric;
  delta  numeric;
begin
  m := assert_member();
  perform assert_wallet_active(p_wallet_id);
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'Bắt buộc nhập lý do điều chỉnh' using errcode = '23514';
  end if;

  before_bal := wallet_balance(p_wallet_id);
  delta := p_actual_balance - before_bal;
  if delta = 0 then
    raise exception 'Số dư đã khớp, không cần điều chỉnh' using errcode = '23514';
  end if;

  insert into transactions (txn_kind, txn_date, amount, reason, balance_before, balance_after,
                            created_by)
  values ('adjustment', p_date, abs(delta), btrim(p_reason), before_bal, p_actual_balance, m)
  returning id into tid;

  insert into ledger_entries (transaction_id, wallet_id, amount)
  values (tid, p_wallet_id, delta);

  return tid;
end;
$$;

-- ---------- Hàm ghi: đảo bút toán (sửa sai) ----------
create or replace function reverse_transaction(
  p_transaction_id uuid,
  p_reason         text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m   uuid;
  t   transactions%rowtype;
  tid uuid;
begin
  m := assert_member();
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'Bắt buộc nhập lý do khi đảo giao dịch' using errcode = '23514';
  end if;

  select * into t from transactions where id = p_transaction_id;
  if not found then
    raise exception 'Giao dịch không tồn tại' using errcode = '23503';
  end if;
  if t.txn_kind = 'reversal' then
    raise exception 'Không thể đảo một bút toán đảo' using errcode = '23514';
  end if;
  if exists (select 1 from transactions where reverses_id = p_transaction_id) then
    raise exception 'Giao dịch này đã được đảo trước đó' using errcode = '23505';
  end if;

  insert into transactions (txn_kind, txn_date, amount, note, reverses_id, created_by)
  values ('reversal', current_date, t.amount, 'Đảo: ' || btrim(p_reason), p_transaction_id, m)
  returning id into tid;

  insert into ledger_entries (transaction_id, wallet_id, amount)
  select tid, wallet_id, -amount
    from ledger_entries
   where transaction_id = p_transaction_id;

  return tid;
end;
$$;

-- ---------- Quyền truy cập ----------
-- Khách và người dùng đã đăng nhập không được ghi trực tiếp vào bảng.
-- Chỉ đọc (và RLS lọc theo thành viên), ghi qua các hàm ở trên.
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function
  is_family_member(),
  current_member_id(),
  wallet_balance(uuid),
  post_income(date, numeric, uuid, uuid, text, text),
  post_expense(date, numeric, uuid, uuid, uuid, uuid, text, text),
  post_transfer(date, numeric, uuid, uuid, text, text),
  post_adjustment(uuid, numeric, text, date),
  reverse_transaction(uuid, text)
to authenticated;
