# Cấu trúc dữ liệu (Google Sheet)

Mọi sheet có dòng 1 là tiêu đề. Kiểu: t = chữ (định dạng văn bản, kể cả ngày yyyy-MM-dd), n = số nguyên. Tiền là số nguyên đồng, không số lẻ. Boolean lưu 1/0.

**Thêm cột mới vào sheet đã có dữ liệu:** chạy `setupSpreadsheet()` lại — `setupCore_` tự thêm cột mới vào **cuối** tiêu đề nếu sheet cũ còn thiếu (không đụng tới dữ liệu hay cột đã có), chỉ báo lỗi nếu một cột đã tồn tại bị đổi tên/đổi thứ tự thật sự. Vì vậy cột mới trong tài liệu này luôn được thêm ở cuối mỗi sheet, không chen giữa.

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

| Cột | Kiểu | Ghi chú |
|---|---|---|
| liability_id | t | |
| name | t | |
| original_amount | n | |
| opening_balance | n | |
| opening_date | t | |
| status | t | |
| term_months | n | Kỳ hạn vay (tháng). Không bắt buộc (có thể để trống). Thêm 07/11/2026. |

## LiabilityEntries
Dòng sổ cái theo khoản vay (dấu − = giảm dư nợ).

| Cột | Kiểu |
|---|---|
| entry_id | t |
| txn_id | t |
| liability_id | t |
| amount | n |

## LiabilityRates
Lãi suất theo từng thời điểm — **chỉ để theo dõi, không dùng trong bất kỳ phép tính dư nợ/kỳ trả nào**. Mỗi lần đổi lãi suất là 1 dòng mới (không sửa đè dòng cũ). Thêm 07/11/2026.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| rate_id | t | |
| liability_id | t | |
| effective_date | t | Ngày áp dụng mức lãi suất này |
| rate_percent | n | %/năm, cho phép số thập phân |
| note | t | |
| created_at | t | |

## GoldLots
Sổ vàng riêng — nhiều lô mua/bán độc lập, tách khỏi `Assets` (asset_type `gold` của Assets không dùng cho vàng nữa). Việc mua/bán thật sự (trừ/cộng ví) nằm ở `Transactions`/`Entries` (txn_kind `gold_purchase`/`gold_sale`, `ref_id` = lot_id) — giống hệt mô hình Assets: tạo lô chỉ lưu metadata, không tự tạo giao dịch. "Đã bán" suy ra từ có `gold_sale` chưa bị đảo cho lot_id đó, không lưu cột riêng. Thêm 07/11/2026.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| lot_id | t | |
| brand | t | Thương hiệu / nơi mua |
| quantity | n | Số chỉ, cho phép số thập phân |
| purchase_value | n | Giá mua (đồng); có thể = 0 nếu được tặng/không rõ giá — khi đó không cần giao dịch ví |
| purchase_date | t | |
| note | t | |
| active | n | |
| source_ref | t | Mã chống trùng khi nhập dữ liệu cũ (`imp:gold:<ID cũ>`), rỗng với lô tạo tay |

## WeddingGifts
Sổ cưới — sổ lưu trữ thuần (quyết định 07/11/2026): **không tạo giao dịch nào**, không ảnh hưởng ví/dòng tiền gia đình. `side`: `Anh` (bên chú rể) | `Em` (bên cô dâu). `repaid` = đã trả lễ lại (đáp lễ) hay chưa, chỉ để đánh dấu. Sửa/xoá tự do (không qua cơ chế khoá xoá kiểu Assets/GoldLots vì không có giao dịch sổ cái nào gắn với nó). Thêm 07/11/2026.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| gift_id | t | |
| wedding_date | t | |
| side | t | `Anh` \| `Em` |
| guest_name | t | Tên khách / gia đình (cột "Gia đình" trong Excel gốc) |
| address | t | |
| cash_amount | n | Tiền mừng (đồng) |
| gold_amount | n | Vàng (chỉ), cho phép số thập phân |
| usd_amount | n | USD |
| relationship | t | Mối quan hệ (tự do, không phải danh mục cố định) |
| payment_method | t | Hình thức (Tiền mặt/Chuyển khoản/Vàng…) |
| repaid | n | 1 = đã trả lễ lại |
| note | t | |
| active | n | |
| source_ref | t | Mã chống trùng khi nhập dữ liệu cũ (`imp:wedding:<STT cũ>`), rỗng với dòng tạo tay |

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

