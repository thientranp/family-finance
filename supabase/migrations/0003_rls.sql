-- =============================================================
-- 0003_rls.sql
-- Row Level Security: chỉ thành viên gia đình (đã liên kết với
-- tài khoản Google) mới đọc được dữ liệu gia đình.
-- Không có chính sách ghi: ghi chỉ qua các hàm post_* và reverse_transaction.
-- =============================================================

alter table family_members   enable row level security;
alter table wallets          enable row level security;
alter table budget_jars      enable row level security;
alter table budget_periods   enable row level security;
alter table jar_budgets      enable row level security;
alter table categories       enable row level security;
alter table transactions     enable row level security;
alter table ledger_entries   enable row level security;
alter table audit_log        enable row level security;

create policy family_members_read on family_members
  for select to authenticated using (is_family_member());
create policy wallets_read on wallets
  for select to authenticated using (is_family_member());
create policy budget_jars_read on budget_jars
  for select to authenticated using (is_family_member());
create policy budget_periods_read on budget_periods
  for select to authenticated using (is_family_member());
create policy jar_budgets_read on jar_budgets
  for select to authenticated using (is_family_member());
create policy categories_read on categories
  for select to authenticated using (is_family_member());
create policy transactions_read on transactions
  for select to authenticated using (is_family_member());
create policy ledger_entries_read on ledger_entries
  for select to authenticated using (is_family_member());
create policy audit_log_read on audit_log
  for select to authenticated using (is_family_member());
