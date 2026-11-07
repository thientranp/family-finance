# Kế hoạch chuyển đổi: Google Sheets + Apps Script → Supabase + Vercel (v0.2)

- **Trạng thái:** DỰ THẢO — CHƯA TRIỂN KHAI CODE. Chờ duyệt trước khi bắt đầu Giai đoạn 0.
- **Căn cứ:** `BUSINESS_RULES.md` + `DATABASE_SCHEMA.md` (bản mới nhất, phản ánh toàn bộ nghiệp vụ đã xây trên Apps Script) và `REQUIREMENTS_SPECIFICATION.md` (đặc tả gốc đã duyệt). Tài liệu này hợp nhất bản kế hoạch Supabase cũ (`02_Project_Documents/IMPLEMENTATION_PLAN_v0.1_Supabase.md`, 05/11/2026) với toàn bộ nghiệp vụ mới phát sinh trong lúc xây trên Apps Script (Sự kiện, Vàng theo lô, Sổ cưới, lãi suất khoản vay theo thời gian, quy trình thẻ tín dụng).
- **Quyết định đã chốt (07/11/2026):** không tối ưu tạm trên Apps Script trong lúc chờ; dùng domain mặc định `*.vercel.app`, không mua domain riêng; dự án mới làm trên máy cá nhân (laptop), không làm tiếp trong môi trường hiện tại.

---

## 1. Vì sao chuyển đổi

Google Apps Script không giữ dữ liệu giữa các lần gọi — mỗi lần chuyển tab là một phiên chạy mới, phải đọc lại toàn bộ sheet liên quan. `Transactions` đã hơn 4.500 dòng, không có index, mỗi lần đọc là quét toàn bộ rồi lọc bằng JavaScript. Độ trễ sẽ tiếp tục tăng theo thời gian. PostgreSQL (Supabase) có index thật; Next.js trên Vercel không có kiểu "cold start" nặng như Apps Script. Đây cũng là kiến trúc đã ưu tiên ban đầu trong `CLAUDE.md` §4, trước khi tạm chuyển sang Apps Script (06/11/2026) để có bản dùng ngay với 0 chi phí.

## 2. Xác minh chi phí free-tier (bắt buộc theo CLAUDE.md §4.1, đã kiểm tra lại 07/11/2026)

| Dịch vụ | Giới hạn free | Đủ dùng cho 2 người? | Rủi ro & cách xử lý |
|---|---|---|---|
| **Supabase Free** | 500 MB database, 5 GB bandwidth/tháng, 1 GB file storage, 50.000 MAU | Dữ liệu hiện tại (~4.500 giao dịch, nhiều năm) chỉ vài MB → dư thừa | **Tự tạm ngưng (pause) sau 1 tuần không hoạt động** (khôi phục được, phải chờ) → thêm 1 cron ping giữ hoạt động (mục 6, Giai đoạn 9). **Không có backup tự động ở free tier** → tự làm export CSV định kỳ (đã là yêu cầu có sẵn ở CLAUDE.md §6.4, không phát sinh việc mới) |
| **Vercel Hobby** | 100 GB bandwidth/tháng, 1.000.000 lượt gọi hàm/tháng | Dư thừa cho 2 người | **Chỉ dành cho dự án cá nhân/phi thương mại** — đúng điều kiện áp dụng, cần nhớ không được dùng app này cho mục đích kinh doanh |
| **GitHub** | Repo private miễn phí | Đang dùng sẵn | Giữ **Private** — không đưa dữ liệu tài chính thật lên repo |
| **Domain** | `*.vercel.app` mặc định | Đủ dùng | Đã chốt: không mua domain riêng |

**Kết luận: 0 đồng/tháng**, với điều kiện có cron ping (Giai đoạn 9) và tự làm backup CSV (đã có sẵn trong kế hoạch).

Nguồn: [Supabase Pricing 2026](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/), [Supabase free tier limits 2026](https://automationatlas.io/answers/supabase-free-tier-limits-2026/), [Vercel Free vs Pro 2026](https://www.fencode.dev/en/blog/vercel-free-vs-pro-2026-official-limits-pricing) — nên tự kiểm tra lại trên trang chính thức (supabase.com/pricing, vercel.com/pricing) ngay trước khi đăng ký.

## 3. Nguyên tắc giữ nguyên khi chuyển đổi

Không có nghiệp vụ nào được phát minh lại. Toàn bộ quy tắc đã chốt trong `BUSINESS_RULES.md` giữ nguyên 100% — chỉ đổi **nơi lưu và cách truy xuất dữ liệu**, không đổi **ý nghĩa dữ liệu**. **53 test case hiện có** (`apps-script/Tests.gs`) dùng làm "đặc tả sống": mỗi quy tắc có 1 test tương đương ở hệ thống mới, chạy được trước khi coi là xong.

## 4. Cấu trúc thư mục dự án mới

```
<THƯ_MỤC_DỰ_ÁN_MỚI>\
├── docs\                        Mang qua từ dự án cũ (xem mục 8 của hướng dẫn cài đặt)
│   ├── REQUIREMENTS_SPECIFICATION.md
│   ├── BUSINESS_RULES.md
│   ├── DATABASE_SCHEMA.md       (bản Sheets — dùng làm cơ sở thiết kế bảng Postgres)
│   ├── DATA_MIGRATION.md
│   └── MIGRATION_PLAN.md        (chính là tài liệu này)
├── CLAUDE.md                    Nguyên tắc chủ đạo — không đổi dù công nghệ đổi
└── 04_Source_Code\              Tạo ở Giai đoạn 0, KHÔNG tạo trước khi duyệt kế hoạch
    ├── app\                     Trang Next.js (giao diện)
    ├── src\
    │   ├── domain\              Logic nghiệp vụ thuần (không phụ thuộc database)
    │   ├── data\                Truy cập database (repository)
    │   └── lib\                 Tiện ích, định dạng tiền
    ├── supabase\migrations\     File migration SQL (có thứ tự, không sửa file đã chạy)
    ├── scripts\import\          Import từ Google Sheets (chạy có kiểm soát)
    ├── tests\                   Kiểm thử đơn vị và tích hợp
    ├── .env.example             Biến môi trường mẫu (không có giá trị thật)
    └── .gitignore                Loại trừ .env, dữ liệu xuất, file Excel
```

Quy tắc: logic tính số dư, chuyển tiền, ngân sách nằm trong `src/domain`, không viết trong giao diện. Không đưa dữ liệu tài chính thật vào Git.

## 5. Mô hình dữ liệu đích (Postgres) — map 1:1 từ `DATABASE_SCHEMA.md` hiện tại

Chi tiết từng cột xem `DATABASE_SCHEMA.md` (bản Sheets). Bảng dưới là ánh xạ sang Postgres, **đầy đủ theo đúng những gì đã xây trên Apps Script**, không phải danh sách rút gọn:

| Bảng Postgres | Nguồn (sheet) | Ghi chú khi chuyển |
|---|---|---|
| `members` | Members | `current_event_id` → cột tự gắn sự kiện theo từng người |
| `wallets` | Wallets | UUID, không dùng tên làm khoá |
| `jars` | Jars | |
| `categories` | Categories | |
| `budgets`, `budget_moves` | Budgets, BudgetMoves | |
| `transactions` | Transactions | Sổ cái — **chỉ `INSERT`, chặn `UPDATE`/`DELETE` bằng trigger/policy** (thay cho chuỗi băm SHA-256 hiện tại — Postgres chặn được tận gốc, không chỉ phát hiện). `amount` kiểu `NUMERIC`. `event_id` giữ nguyên ý nghĩa (chỉ áp dụng Chi tiêu) |
| `entries` | Entries | Dòng sổ cái theo ví |
| `assets` | Assets | Không định giá lại |
| `liabilities`, `liability_entries` | Liabilities, LiabilityEntries | |
| `liability_rates` | LiabilityRates | Lịch sử lãi suất — chỉ theo dõi, không dùng trong tính dư nợ |
| `gold_lots` | GoldLots | Sổ vàng theo lô, tách khỏi Assets |
| `wedding_gifts` | WeddingGifts | Sổ lưu trữ thuần — không sinh giao dịch |
| `events` | Events | Sự kiện (chuyến đi/dịp) — chỉ gắn Chi tiêu, 1 giao dịch 1 sự kiện |
| `debts`, `debt_entries` | Debts, DebtEntries | Nợ cá nhân (vay mượn người quen), khác Liabilities |
| `reminders`, `notifications` | Reminders, Notifications | |
| `audit_log` | AuditLog | Chỉ thêm |
| `settings` | Settings | |

**Thẻ tín dụng (HSBC):** không cần bảng riêng — dùng lại `wallets` (loại `bank`, cho phép số dư âm bằng cách không đặt CHECK constraint chặn âm cho loại này) + `liabilities`/`liability_rates` cho từng gói trả góp, đúng quy trình đã ghi trong `BUSINESS_RULES.md`.

**Số dư ví** không lưu cứng — tính bằng một hàm SQL (hoặc view) duy nhất: số dư đầu kỳ + thu − chi + chuyển vào − chuyển ra + điều chỉnh.

## 6. Các giai đoạn triển khai

Mỗi giai đoạn kết thúc bằng: danh sách file thay đổi, kết quả kiểm thử thật, vấn đề còn lại, bước tiếp theo (CLAUDE.md §2.4).

### Giai đoạn 0 — Nền tảng
- Tạo repo GitHub **private** mới, khởi tạo Next.js + TypeScript + Tailwind + shadcn/ui.
- `.gitignore`, `.env.example`, tài liệu môi trường.
- Thiết lập kiểm tra kiểu (TypeScript), lint, kiểm thử đơn vị (Vitest).
- **Xong khi:** ứng dụng trống chạy được; kiểm tra kiểu và lint pass; `npm test` chạy được (chưa cần test nào).

### Giai đoạn 1 — Database và bảo mật
- Viết migration SQL đầu tiên: toàn bộ bảng ở mục 5, khoá ngoại, ràng buộc, index (ngày giao dịch, ví, lọ, sự kiện).
- Hàm/trigger tính số dư ví; trigger chặn `UPDATE`/`DELETE` trên `transactions` và `audit_log`.
- Bật Row Level Security (RLS): chỉ 2 thành viên gia đình đọc/ghi được dữ liệu gia đình; dữ liệu cá nhân theo đúng quyền sở hữu đã có (scope `shared`/`personal` ở Wallets, Events...).
- Cập nhật `DATABASE_SCHEMA.md` cho Postgres; viết `SECURITY.md`.
- **Xong khi:** migration chạy trên database trống và chạy lại không lỗi; tài khoản ngoài gia đình bị RLS chặn (có test); sửa/xoá giao dịch đều bị từ chối (có test).

### Giai đoạn 2 — Đăng nhập
- Supabase Auth, đăng nhập Google độc lập cho Cục Thịt và Cục Cá.
- Gán tài khoản Google với `members` — không tin ID gửi từ trình duyệt.
- **Xong khi:** mỗi người đăng nhập được bằng tài khoản Google riêng; tài khoản thứ ba bị từ chối.

### Giai đoạn 3 — Ví, giao dịch, chuyển tiền, điều chỉnh
- CRUD ví. Thêm/sửa/huỷ giao dịch Thu/Chi (sửa bằng bút toán đảo, không sửa/xoá cứng).
- Chuyển tiền giữa ví: giao dịch nguyên tử, chống ghi trùng (idempotency key).
- Điều chỉnh số dư: bắt buộc lý do, ghi số trước/sau.
- **Xong khi (test tích hợp):** Thu tăng đúng ví, Chi giảm đúng ví; Chuyển: ví nguồn giảm/ví đích tăng/tổng gia đình không đổi/không tính thu chi; chuyển lỗi giữa chừng không đổi ví nào; gửi lại cùng giao dịch chỉ ghi 1 lần; điều chỉnh âm/dương đúng dấu.

### Giai đoạn 4 — Ngân sách 6 lọ
- Tạo tháng, sao chép từ tháng trước; sửa từng lọ; tháng cũ không đổi; chuyển ngân sách giữa lọ (có lịch sử).
- **Xong khi:** số đã dùng/còn lại/vượt đúng; sao chép đúng; sửa tháng mới không ảnh hưởng tháng cũ.

### Giai đoạn 5 — Tài sản, khoản vay, vàng, sổ cưới, sự kiện
- Assets (không định giá lại), Liabilities + LiabilityRates (lãi suất theo thời gian), GoldLots, WeddingGifts, Events (tự gắn theo từng người + ghi đè tay).
- Quy trình thẻ tín dụng theo `BUSINESS_RULES.md` (ví số dư âm + chuyển ví + Liability cho gói trả góp + điều chỉnh khi chuyển đổi).
- **Xong khi:** dư nợ sau kỳ đúng; tài sản ròng đúng công thức; sự kiện tự gắn đúng người, không ảnh hưởng người khác; test tương đương 53 test cũ đạt.

### Giai đoạn 6 — Di chuyển dữ liệu từ Google Sheets
- Script đọc trực tiếp từng sheet hiện tại (qua Sheets API hoặc export CSV), nạp vào bảng staging trước, có ghi nguồn + số dòng.
- Chuẩn hoá, import có kiểm soát, mã chống trùng (giữ nguyên `source_ref`/`idempotency_key` đã có).
- Đối soát số dòng + tổng tiền từng loại giữa Sheets và Postgres, xuất báo cáo.
- **Xong khi:** số dòng khớp 100% (so với số liệu đã có trong `DATA_MIGRATION.md`); tổng thu/chi/số dư ví khớp 100%; chạy lại script không tạo dòng trùng.

### Giai đoạn 7 — Giao diện
- Dựng lại từng màn hình đã có trên Apps Script: Tổng quan, Thêm giao dịch, Danh sách, Ví, Ngân sách, Tài sản/Nợ, Sự kiện, Vàng, Sổ cưới, Admin.
- **Xong khi:** dùng được đầy đủ như bản Apps Script, trên điện thoại và desktop, không lỗi console.

### Giai đoạn 8 — Kiểm thử tổng thể
- Dịch 53 test case hiện có (Vitest + database test thật, không mock); bổ sung test Auth/RLS; Playwright cho luồng nhập nhanh trên điện thoại.
- **Xong khi:** toàn bộ test đạt.

### Giai đoạn 9 — Chạy song song, sao lưu, triển khai
- Chạy thử vài ngày–2 tuần, nhập liệu thật, đối chiếu số liệu với hệ Apps Script (vẫn giữ, chưa tắt).
- Cron ping giữ Supabase project không bị pause; export CSV/Excel định kỳ (đã có quy trình tương tự ở Apps Script, áp dụng lại).
- Triển khai Vercel (domain mặc định `*.vercel.app`), kiểm tra trên điện thoại.
- **Xong khi:** hai hệ cho cùng kết quả trong thời gian chạy song song; khôi phục từ backup thử thành công; không có lỗi nghiêm trọng.

### Giai đoạn 10 — Chuyển chính thức
- Sau khi bạn xác nhận ổn: dùng hệ mới làm chính, đóng (không xoá) Apps Script — giữ làm lịch sử.
- **Xong khi:** Google Sheets không còn là nơi ghi dữ liệu sống, chỉ còn là lịch sử.

## 7. Rủi ro chính

| Rủi ro | Mức | Cách xử lý |
|---|---|---|
| Viết lại sai một quy tắc nghiệp vụ đã chốt | Cao | Dùng 53 test hiện có làm đặc tả, không viết lại logic "theo trí nhớ" |
| Mất/lệch dữ liệu khi di chuyển Sheets → Postgres | Cao | Đối soát số dòng + tổng tiền bắt buộc trước khi coi Giai đoạn 6 xong |
| Supabase pause sau 1 tuần không hoạt động | Trung bình | Cron ping định kỳ (Giai đoạn 9) |
| Supabase Free không có backup tự động | Trung bình | Tự export CSV định kỳ (đã có quy trình tương tự) |
| Thời gian thực hiện dài hơn các giai đoạn trước | Trung bình | Làm theo từng giai đoạn ở mục 6, báo cáo sau mỗi giai đoạn, không dồn thành 1 lần code lớn |
| Google Sheets vẫn phải dùng để ghi chép hằng ngày trong lúc chuyển đổi | Thấp | Hệ Apps Script không bị động đến cho tới Giai đoạn 10 |
| Vercel Hobby chỉ phi thương mại | Thấp | Ứng dụng gia đình, đúng điều kiện |

## 8. Kiểm thử

| Loại | Phạm vi | Công cụ |
|---|---|---|
| Đơn vị | Hàm tính số dư, chuyển tiền, ngân sách, lãi vay | Vitest |
| Tích hợp | Giao dịch nguyên tử, RLS, trigger, import | Vitest + Postgres thật (không mock) |
| Đối soát | Số dòng và tổng tiền sau import | Script riêng, xuất báo cáo |
| Giao diện | Luồng nhập nhanh trên điện thoại | Playwright |
