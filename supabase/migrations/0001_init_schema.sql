-- =============================================================
-- 0001_init_schema.sql
-- Family Finance: cấu trúc bảng cơ bản (giai đoạn 1)
-- Chạy trên PostgreSQL chuẩn. Supabase: cần schema auth có sẵn.
-- Tiền dùng NUMERIC(18,2). Không dùng số thực dấu phẩy động.
-- =============================================================

-- ---------- Thành viên gia đình ----------
create table family_members (
  id            uuid primary key default gen_random_uuid(),
  display_name  text not null unique,
  -- Liên kết với tài khoản Google (Supabase Auth). Gán thủ công sau khi đăng nhập lần đầu.
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

insert into family_members (display_name) values ('Cục Thịt'), ('Cục Cá');

-- ---------- Ví ----------
create table wallets (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code ~ '^W[0-9]{3}$'),
  name             text not null unique,
  wallet_type      text not null check (wallet_type in ('cash', 'bank', 'held_in_trust')),
  bank_name        text,
  owner_member_id  uuid not null references family_members (id),
  -- Chỉ dùng cho ví giữ hộ: tên người gửi tiền
  holder_name      text,
  currency         text not null default 'VND' check (currency = 'VND'),
  -- Số dư tại đầu ngày opening_date (trước mọi giao dịch trong ngày đó)
  opening_balance  numeric(18, 2) not null default 0,
  opening_date     date not null,
  status           text not null default 'active' check (status in ('active', 'closed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check ((wallet_type = 'held_in_trust') = (holder_name is not null))
);

create index wallets_owner_idx on wallets (owner_member_id);

-- ---------- Lọ ngân sách ----------
create table budget_jars (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^J[1-9]$'),
  name        text not null unique,
  sort_order  int not null unique,
  is_active   boolean not null default true
);

-- 6 lọ làm việc (tên và số tiền có thể đổi sau; theo đặc tả mục 4)
insert into budget_jars (code, name, sort_order) values
  ('J1', 'Thiết yếu',               1),
  ('J2', 'Ăn uống ngoài',           2),
  ('J3', 'Xe và di chuyển',         3),
  ('J4', 'Gia đình và con',         4),
  ('J5', 'Cá nhân và vui chơi',     5),
  ('J6', 'Cho đi và xã hội',        6);

-- ---------- Kỳ ngân sách (tháng) ----------
create table budget_periods (
  id      uuid primary key default gen_random_uuid(),
  year    int not null check (year between 2000 and 2100),
  month   int not null check (month between 1 and 12),
  unique (year, month)
);

-- Số tiền từng lọ trong từng tháng. Tháng cũ không bị đổi khi sửa tháng mới.
create table jar_budgets (
  period_id  uuid not null references budget_periods (id),
  jar_id     uuid not null references budget_jars (id),
  amount     numeric(18, 2) not null check (amount >= 0),
  primary key (period_id, jar_id)
);

-- ---------- Danh mục chi/thu ----------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  txn_kind    text not null check (txn_kind in ('income', 'expense')),
  -- Chi tiêu bắt buộc thuộc một lọ. Thu nhập không thuộc lọ.
  jar_id      uuid references budget_jars (id),
  check ((txn_kind = 'expense') = (jar_id is not null))
);

-- ---------- Giao dịch (đầu phiếu) ----------
-- Mỗi giao dịch có một hoặc nhiều dòng sổ cái (ledger_entries).
-- Không sửa, không xóa. Sửa sai bằng bút toán đảo (reversal).
create table transactions (
  id                    uuid primary key default gen_random_uuid(),
  txn_kind              text not null check (txn_kind in ('income', 'expense', 'transfer', 'adjustment', 'reversal')),
  txn_date              date not null,
  amount                numeric(18, 2) not null check (amount > 0),
  category_id           uuid references categories (id),
  jar_id                uuid references budget_jars (id),
  paid_by_member_id     uuid references family_members (id),
  beneficiary_member_id uuid references family_members (id),
  note                  text,
  -- Chỉ dùng cho điều chỉnh số dư (REQ-007)
  reason                text,
  balance_before        numeric(18, 2),
  balance_after         numeric(18, 2),
  -- Bút toán đảo trỏ về giao dịch gốc (mỗi giao dịch chỉ bị đảo một lần)
  reverses_id           uuid unique references transactions (id),
  -- Chống ghi trùng khi người dùng bấm gửi nhiều lần
  idempotency_key       text unique,
  created_by            uuid not null references family_members (id),
  created_at            timestamptz not null default now(),

  -- Lọ: chi tiêu bắt buộc có lọ; thu nhập, chuyển, điều chỉnh, đảo thì không có lọ
  check (
    (txn_kind = 'expense' and jar_id is not null)
    or (txn_kind <> 'expense' and jar_id is null)
  ),
  check (txn_kind in ('income', 'expense') or category_id is null),
  -- Điều chỉnh: bắt buộc có lý do và số dư trước/sau
  check (
    txn_kind <> 'adjustment'
    or (reason is not null and length(btrim(reason)) > 0
        and balance_before is not null and balance_after is not null)
  ),
  check (txn_kind = 'adjustment' or (reason is null and balance_before is null and balance_after is null)),
  -- Bút toán đảo phải có giao dịch gốc; giao dịch khác không được có
  check ((txn_kind = 'reversal') = (reverses_id is not null))
);

create index transactions_date_idx on transactions (txn_date);
create index transactions_created_by_idx on transactions (created_by);

-- ---------- Dòng sổ cái ----------
-- amount có dấu: dương là tăng số dư ví, âm là giảm.
create table ledger_entries (
  id              bigint generated always as identity primary key,
  transaction_id  uuid not null references transactions (id),
  wallet_id       uuid not null references wallets (id),
  amount          numeric(18, 2) not null check (amount <> 0)
);

create index ledger_entries_wallet_idx on ledger_entries (wallet_id);
create index ledger_entries_txn_idx on ledger_entries (transaction_id);

-- ---------- Nhật ký thao tác quan trọng ----------
create table audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  row_id      text not null,
  action      text not null,
  actor_id    uuid,
  payload     jsonb,
  created_at  timestamptz not null default now()
);
