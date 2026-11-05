-- =============================================================
-- Kiểm thử: sổ cái, chuyển tiền, điều chỉnh, đảo, bất biến, RLS
-- Chạy sau khi đã chạy 0001, 0002, 0003 (và stub nếu là PostgreSQL cục bộ).
-- Dừng ngay ở lỗi đầu tiên. Thành công thì in "ALL TESTS PASSED".
-- =============================================================
\set ON_ERROR_STOP on

create or replace function test_assert(p_ok boolean, p_msg text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'TEST FAILED: %', p_msg;
  end if;
end;
$$;

create or replace function test_expect_error(p_sql text, p_msg text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'TEST FAILED (kỳ vọng lỗi nhưng không có lỗi): %', p_msg;
exception when others then
  if sqlerrm like 'TEST FAILED%' then
    raise;
  end if;
end;
$$;

-- ---------- Dữ liệu nền ----------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'thit@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'ca@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'nguoi-ngoai@test.local');

update family_members set auth_user_id = '11111111-1111-1111-1111-111111111111' where display_name = 'Cục Thịt';
update family_members set auth_user_id = '22222222-2222-2222-2222-222222222222' where display_name = 'Cục Cá';

insert into wallets (code, name, wallet_type, owner_member_id, opening_balance, opening_date)
select 'W001', 'Ví - Cục Thịt', 'cash', id, 1000000, date '2026-11-01'
  from family_members where display_name = 'Cục Thịt';
insert into wallets (code, name, wallet_type, owner_member_id, opening_balance, opening_date)
select 'W005', 'Vietinbank - Cục Thịt', 'bank', id, 10000000, date '2026-11-01'
  from family_members where display_name = 'Cục Thịt';
insert into wallets (code, name, wallet_type, owner_member_id, opening_balance, opening_date)
select 'W006', 'Vietinbank - Cục Cá', 'bank', id, 0, date '2026-11-01'
  from family_members where display_name = 'Cục Cá';
insert into wallets (code, name, wallet_type, owner_member_id, holder_name, opening_balance, opening_date)
select 'W008', 'Beo', 'held_in_trust', id, 'Người gửi (kiểm thử)', 0, date '2026-11-01'
  from family_members where display_name = 'Cục Thịt';

-- ---------- Kiểm thử bằng vai trò Cục Thịt ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

-- T1: thu nhập tăng đúng ví
select post_income(date '2026-11-02', 5000000, (select id from wallets where code = 'W001'), null, 'Lương test', 'key-income-1');
select test_assert(wallet_balance((select id from wallets where code='W001')) = 6000000, 'T1: thu nhập phải tăng W001 lên 6.000.000');

-- T2: chi tiêu giảm đúng ví, gắn đúng lọ
select post_expense(date '2026-11-02', 300000, (select id from wallets where code='W001'),
                    (select id from budget_jars where code='J1'), null, null, 'Đi chợ test', 'key-expense-1');
select test_assert(wallet_balance((select id from wallets where code='W001')) = 5700000, 'T2: chi tiêu phải giảm W001 còn 5.700.000');

-- T3: chuyển tiền nguyên tử, tổng hai ví không đổi, không tính là thu chi
select post_transfer(date '2026-11-03', 1000000, (select id from wallets where code='W005'),
                     (select id from wallets where code='W001'), 'Chuyển test', 'key-transfer-1');
select test_assert(wallet_balance((select id from wallets where code='W005')) = 9000000, 'T3: W005 phải giảm còn 9.000.000');
select test_assert(wallet_balance((select id from wallets where code='W001')) = 6700000, 'T3: W001 phải tăng lên 6.700.000');
select test_assert(
  wallet_balance((select id from wallets where code='W005')) + wallet_balance((select id from wallets where code='W001')) = 15700000,
  'T3: tổng hai ví phải không đổi');

-- T4: chống ghi trùng bằng khóa idempotency
select test_assert(
  post_income(date '2026-11-02', 5000000, (select id from wallets where code='W001'), null, 'Lương test', 'key-income-1')
  = (select id from transactions where idempotency_key = 'key-income-1'),
  'T4: cùng khóa phải trả về cùng giao dịch');
select test_assert(
  (select count(*) from transactions where idempotency_key = 'key-income-1') = 1,
  'T4: không được tạo giao dịch trùng');
select test_assert(wallet_balance((select id from wallets where code='W001')) = 6700000,
  'T4: số dư không được đổi khi gửi trùng');

-- T5: không chuyển cho chính ví đó
select test_expect_error(
  $q$select post_transfer(date '2026-11-03', 100, (select id from wallets where code='W001'), (select id from wallets where code='W001'), null, null)$q$,
  'T5: chuyển cùng ví phải bị từ chối');

-- T6: điều chỉnh đối soát âm (giảm số dư), có lý do, ghi số trước và sau
select post_adjustment((select id from wallets where code='W001'), 6500000, 'Đối soát test');
select test_assert(wallet_balance((select id from wallets where code='W001')) = 6500000, 'T6: điều chỉnh âm phải giảm còn 6.500.000');
select test_assert(
  exists (select 1 from transactions where txn_kind='adjustment' and balance_before = 6700000 and balance_after = 6500000 and reason = 'Đối soát test'),
  'T6: phải lưu số trước, số sau và lý do');

-- T7: điều chỉnh không có lý do, hoặc không có chênh lệch, bị từ chối
select test_expect_error(
  $q$select post_adjustment((select id from wallets where code='W001'), 6400000, '   ')$q$,
  'T7: thiếu lý do phải bị từ chối');
select test_expect_error(
  $q$select post_adjustment((select id from wallets where code='W001'), 6500000, 'Không đổi')$q$,
  'T7: không có chênh lệch phải bị từ chối');

-- T8: điều chỉnh dương (tăng số dư)
select post_adjustment((select id from wallets where code='W001'), 6600000, 'Đối soát dương test');
select test_assert(wallet_balance((select id from wallets where code='W001')) = 6600000, 'T8: điều chỉnh dương phải tăng lên 6.600.000');

-- T9: sửa sai bằng bút toán đảo, không xóa giao dịch cũ
select reverse_transaction((select id from transactions where idempotency_key='key-expense-1'), 'Nhập nhầm test');
select test_assert(wallet_balance((select id from wallets where code='W001')) = 6900000, 'T9: đảo chi tiêu 300.000 phải tăng W001 lên 6.900.000');
select test_assert(exists (select 1 from transactions where idempotency_key='key-expense-1'), 'T9: giao dịch gốc vẫn còn');
select test_expect_error(
  $q$select reverse_transaction((select id from transactions where idempotency_key='key-expense-1'), 'Đảo lần 2')$q$,
  'T9: không được đảo hai lần');

-- T10: giao dịch trước ngày cắt không ảnh hưởng số dư hiện tại
select post_income(date '2026-10-15', 999000, (select id from wallets where code='W001'), null, 'Lịch sử test', null);
select test_assert(wallet_balance((select id from wallets where code='W001')) = 6900000,
  'T10: giao dịch trước ngày cắt không được đổi số dư hiện tại');

-- T11: ví đã đóng không nhận giao dịch (đổi trạng thái bằng quyền quản trị)
reset role;
update wallets set status = 'closed' where code = 'W008';
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select test_expect_error(
  $q$select post_income(date '2026-11-02', 100, (select id from wallets where code='W008'), null, null, null)$q$,
  'T11: ví đã đóng phải bị từ chối');
reset role;
update wallets set status = 'active' where code = 'W008';
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

-- T12: không được sửa hay xóa lịch sử
select test_expect_error($q$update transactions set note = 'sửa' where true$q$, 'T12: không được sửa giao dịch');
select test_expect_error($q$delete from ledger_entries where true$q$, 'T12: không được xóa dòng sổ cái');

reset role;

-- ---------- Kiểm thử vai trò quản trị (superuser) ----------
-- T13: giao dịch thiếu dòng sổ cái bị từ chối khi commit
do $$
begin
  insert into transactions (txn_kind, txn_date, amount, created_by)
  values ('income', date '2026-11-02', 100, (select id from family_members where display_name='Cục Thịt'));
  set constraints all immediate;
  raise exception 'NO_ERROR';
exception when others then
  if sqlerrm = 'NO_ERROR' then
    raise exception 'TEST FAILED: T13 giao dịch thiếu dòng sổ cái không bị từ chối';
  end if;
end;
$$;

-- T14: dòng sổ cái sai số tiền (chi 200 nhưng sổ ghi -100) bị từ chối
do $$
declare tid uuid;
begin
  insert into transactions (txn_kind, txn_date, amount, jar_id, created_by)
  values ('expense', date '2026-11-02', 200, (select id from budget_jars where code='J1'), (select id from family_members where display_name='Cục Thịt'))
  returning id into tid;
  insert into ledger_entries (transaction_id, wallet_id, amount)
  values (tid, (select id from wallets where code='W001'), -100);
  set constraints all immediate;
  raise exception 'NO_ERROR';
exception when others then
  if sqlerrm = 'NO_ERROR' then
    raise exception 'TEST FAILED: T14 dòng sổ cái không khớp không bị từ chối';
  end if;
end;
$$;

-- ---------- Kiểm thử RLS ----------
-- T15: người ngoài gia đình không thấy dữ liệu nào
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select test_assert((select count(*) from wallets) = 0, 'T15: người ngoài không được thấy ví');
select test_assert((select count(*) from transactions) = 0, 'T15: người ngoài không được thấy giao dịch');
select test_assert((select count(*) from ledger_entries) = 0, 'T15: người ngoài không được thấy sổ cái');
select test_expect_error(
  $q$select post_income(date '2026-11-02', 100, (select id from wallets limit 1), null, null, null)$q$,
  'T15: người ngoài không được ghi giao dịch');

-- T16: Cục Cá thấy dữ liệu gia đình
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select test_assert((select count(*) from wallets) = 4, 'T16: Cục Cá phải thấy đủ 4 ví');
select test_assert((select count(*) from family_members) = 2, 'T16: Cục Cá phải thấy hai thành viên');

-- T17: không ghi trực tiếp vào bảng, kể cả với thành viên
select test_expect_error(
  $q$insert into wallets (code, name, wallet_type, owner_member_id, opening_date) select 'W099', 'Trực tiếp', 'cash', id, date '2026-11-01' from family_members limit 1$q$,
  'T17: không được ghi trực tiếp vào bảng ví');

reset role;

-- ---------- Kết quả ----------
select 'ALL TESTS PASSED' as result;
