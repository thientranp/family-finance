# Cấu trúc dữ liệu (Google Sheet)

Mọi sheet có dòng 1 là tiêu đề. Kiểu: t = chữ (định dạng văn bản, kể cả ngày yyyy-MM-dd), n = số nguyên. Tiền là số nguyên đồng, không số lẻ. Boolean lưu 1/0.

## Members

| Cột | Kiểu |
|---|---|
| member_id | t |
| display_name | t |
| email | t |
| active | n |

## Wallets

| Cột | Kiểu |
|---|---|
| wallet_id | t |
| name | t |
| wallet_type | t |
| bank_name | t |
| owner_member_id | t |
| holder_name | t |
| opening_balance | n |
| opening_date | t |
| status | t |

## Jars

| Cột | Kiểu |
|---|---|
| jar_id | t |
| name | t |
| sort_order | n |
| active | n |

## Categories

| Cột | Kiểu |
|---|---|
| category_id | t |
| name | t |
| kind | t |
| jar_id | t |
| active | n |

## Budgets

| Cột | Kiểu |
|---|---|
| period | t |
| jar_id | t |
| amount | n |
| created_at | t |
| created_by | t |

## BudgetMoves

| Cột | Kiểu |
|---|---|
| move_id | t |
| period | t |
| from_jar | t |
| to_jar | t |
| amount | n |
| reason | t |
| created_by | t |
| created_at | t |

## Transactions
Sổ cái KHÔNG sửa/xóa. Ghi **sau cùng** (dấu xác nhận hoàn tất). Sửa sai bằng bút toán đảo (reversal). prev_hash/row_hash tạo chuỗi băm SHA-256 để phát hiện sửa tay.

| Cột | Kiểu |
|---|---|
| txn_id | t |
| txn_kind | t |
| txn_date | t |
| amount | n |
| category_id | t |
| jar_id | t |
| paid_by | t |
| beneficiary | t |
| note | t |
| reason | t |
| balance_before | n |
| balance_after | n |
| reverses_id | t |
| ref_id | t |
| idempotency_key | t |
| entry_count | n |
| created_by | t |
| created_at | t |
| prev_hash | t |
| row_hash | t |

## Entries
Dòng sổ cái theo ví, số tiền có dấu (+ vào ví, − ra ví). Số dư ví = số dư đầu + tổng Entries từ ngày bắt đầu của ví.

| Cột | Kiểu |
|---|---|
| entry_id | t |
| txn_id | t |
| wallet_id | t |
| amount | n |

## Assets

| Cột | Kiểu |
|---|---|
| asset_id | t |
| asset_type | t |
| name | t |
| purchase_value | n |
| purchase_date | t |
| note | t |
| active | n |

## Liabilities

| Cột | Kiểu |
|---|---|
| liability_id | t |
| name | t |
| original_amount | n |
| opening_balance | n |
| opening_date | t |
| status | t |

## LiabilityEntries
Dòng sổ cái theo khoản vay (dấu − = giảm dư nợ).

| Cột | Kiểu |
|---|---|
| entry_id | t |
| txn_id | t |
| liability_id | t |
| amount | n |

## Debts
Sổ nợ cá nhân (vay mượn người quen) — khác `Liabilities` (nợ ngân hàng). Không có cột số dư: số dư còn nợ luôn tính từ `DebtEntries`, bắt đầu từ 0 (xem Ledger bên dưới).

| Cột | Kiểu | Ghi chú |
|---|---|---|
| debt_id | t | |
| direction | t | `lend` (gia đình cho vay) \| `borrow` (gia đình vay nợ) |
| counterparty | t | tên người vay/cho vay (chữ tự do, không bắt buộc là thành viên trong Members) |
| original_amount | n | số tiền gốc ban đầu, không đổi |
| opening_date | t | ngày phát sinh khoản nợ |
| note | t | |

## DebtEntries
Dòng sổ cái theo khoản nợ cá nhân (dấu + = số dư còn nợ tăng, dấu − = giảm). Bút toán tạo khoản nợ (`debt_lend`/`debt_borrow`) đưa số dư từ 0 lên `original_amount`; nhờ vậy đảo bút toán tạo khoản nợ cũng tự đưa số dư về 0 đúng, không cần một `opening_balance` tĩnh như `Liabilities`.

| Cột | Kiểu |
|---|---|
| entry_id | t |
| txn_id | t |
| debt_id | t |
| amount | n |

## Reminders

| Cột | Kiểu |
|---|---|
| reminder_id | t |
| type | t |
| title | t |
| day_of_month | n |
| days_before | n |
| ref_id | t |
| active | n |

## Notifications
Chống gửi trùng email (key + người nhận), thử lại tối đa 3 lần.

| Cột | Kiểu |
|---|---|
| key | t |
| created_at | t |
| to | t |
| subject | t |
| status | t |
| attempts | n |
| last_error | t |

## AuditLog
Nhật ký thay đổi cấu hình, sao lưu, lỗi và sửa tay.

| Cột | Kiểu |
|---|---|
| ts | t |
| actor | t |
| action | t |
| ref_id | t |
| details | t |

## Settings
Cài đặt: env, cutoff_date, budget_warn_pct, data_entry_days, weekly_keep, monthly_keep, last_* trạng thái.

| Cột | Kiểu |
|---|---|
| key | t |
| value | t |

