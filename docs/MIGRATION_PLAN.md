# Kế hoạch chuyển đổi: Google Sheets + Apps Script → Supabase + Vercel

Trạng thái: **DỰ THẢO — CHƯA TRIỂN KHAI**, chờ bạn duyệt trước khi bắt đầu code (theo nguyên tắc "Tài liệu trước khi triển khai" ở CLAUDE.md §2.3).

Tài liệu này chỉ lập kế hoạch. Chưa có dòng code nào của việc chuyển đổi được viết.

---

## 1. Vì sao chuyển đổi

Hệ thống hiện tại (Google Sheets làm database + Google Apps Script làm backend/frontend) đang chậm khi chuyển tab vì:
- Apps Script không giữ dữ liệu giữa các lần gọi — mỗi lần chuyển tab là một phiên chạy mới, phải đọc lại toàn bộ sheet liên quan từ đầu.
- `Transactions` đã hơn 4.500 dòng, không có index — mỗi lần đọc là quét toàn bộ, lọc bằng JavaScript.
- Google Apps Script web app có độ trễ khởi động riêng (cold start).
- Độ trễ sẽ tiếp tục **tăng dần** theo thời gian vì giao dịch ghi mỗi ngày, không có điểm dừng.

Supabase (PostgreSQL thật, có index) + Next.js trên Vercel (không có cold start nặng kiểu Apps Script) là kiến trúc đã ưu tiên ban đầu trong CLAUDE.md §4, giải quyết tận gốc vấn đề tốc độ chứ không chỉ giảm nhẹ.

## 2. Xác minh chi phí (CLAUDE.md §4.1 — bắt buộc kiểm tra trước khi chọn dịch vụ)

Đã kiểm tra lại giới hạn free tier hiện hành (11/2026):

| Dịch vụ | Giới hạn free | Có đủ cho gia đình 2 người dùng? |
|---|---|---|
| **Supabase Free** | 500 MB database, 5 GB bandwidth/tháng, 1 GB file storage, **tự tạm ngưng (pause) project sau 1 tuần không hoạt động** (khôi phục được từ dashboard nhưng phải chờ), **không có backup tự động** ở free tier | Dữ liệu hiện tại (~4.500 giao dịch, nhiều năm) chỉ vài MB → dư thừa dung lượng. Bandwidth dư thừa cho 2 người. Rủi ro "pause" nếu không ai mở app 1 tuần liền — cần có cơ chế ping định kỳ để tránh. Backup phải tự làm (đã có yêu cầu này sẵn ở CLAUDE.md §6.4 nên không phát sinh thêm việc). |
| **Vercel Hobby** | 100 GB bandwidth/tháng, 1.000.000 lượt gọi hàm/tháng, **chỉ dành cho dự án cá nhân/phi thương mại** | Dư thừa cho 2 người dùng; dự án gia đình phi thương mại → đúng điều kiện áp dụng. |
| **GitHub** | Repo private miễn phí | Đang dùng sẵn. |
| **Tên miền** | Dùng domain mặc định `*.vercel.app`, không cần mua domain riêng | 0 đồng; mua domain riêng là tuỳ chọn, không bắt buộc. |

**Kết luận chi phí: 0 đồng/tháng**, với điều kiện xử lý rủi ro "pause sau 1 tuần không hoạt động" (mục 5 bên dưới) và tự làm backup (vốn đã là yêu cầu có sẵn).

Nguồn tham khảo: [Supabase Pricing 2026 Guide](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/), [Supabase free tier limits 2026](https://automationatlas.io/answers/supabase-free-tier-limits-2026/), [Vercel Free vs Pro 2026](https://www.fencode.dev/en/blog/vercel-free-vs-pro-2026-official-limits-pricing) — nên tự kiểm tra lại trên trang chính thức (supabase.com/pricing, vercel.com/pricing) ngay trước khi đăng ký, vì các mức này có thể đổi.

## 3. Nguyên tắc giữ nguyên khi chuyển đổi

Không có nghiệp vụ nào được phát minh lại. Toàn bộ quy tắc đã chốt trong `BUSINESS_RULES.md` (sổ cái bất biến, chuyển ví không tính thu/chi, điều chỉnh số dư, sự kiện, lọ ngân sách, vàng, sổ cưới, khoản vay/lãi suất, thẻ tín dụng...) giữ nguyên 100% — chỉ đổi **nơi lưu và cách truy xuất dữ liệu**, không đổi **ý nghĩa dữ liệu**.

**53 test case hiện có** (`apps-script/Tests.gs`) được dùng làm "đặc tả sống" — mỗi quy tắc sẽ có 1 test tương đương ở hệ thống mới, chạy được trước khi coi là xong, không chỉ dịch code mà không kiểm tra lại.

## 4. Thiết kế kiến trúc mới

| Lớp | Hiện tại | Sau khi chuyển |
|---|---|---|
| Lưu trữ | Google Sheets (20 sheet) | PostgreSQL (Supabase) — mỗi sheet → 1 bảng, giữ đúng tên cột, thêm index cho các cột lọc nhiều (ngày, loại giao dịch, ví, lọ, sự kiện) |
| Số tiền | Số nguyên JS | `NUMERIC` (không dùng số thực, đúng CLAUDE.md §5.2) |
| Khoá chính | Chuỗi tự sinh | `UUID` (đúng CLAUDE.md §5.1), **không** dùng tên hiển thị (Cục Thịt/Cục Cá, tên ví, tên lọ...) làm khoá — giữ đúng nguyên tắc đã có |
| Chống sửa sổ cái | Chuỗi băm SHA-256 lưu trong cột | Bảng `Transactions` chỉ cho `INSERT`, chặn `UPDATE`/`DELETE` bằng trigger/policy ở database — chặt hơn cơ chế hiện tại (hiện tại chỉ *phát hiện* sửa tay, không *chặn* được) |
| Xác thực | Email cố định kiểm tra trong code | Supabase Auth, đăng nhập bằng Google (đúng CLAUDE.md §6.1), chỉ 2 tài khoản Google của Cục Thịt/Cục Cá được phép |
| Phân quyền | Kiểm tra tay trong Apps Script | PostgreSQL Row Level Security (RLS) — đúng CLAUDE.md §6.2, dữ liệu cá nhân/chung phân quyền ngay ở tầng database |
| Backend | Apps Script (`doGet`/`doPost`) | Next.js API routes / Server Actions trên Vercel |
| Giao diện | HTML dựng tay trong `Index.html` | Next.js + TypeScript + Tailwind + shadcn/ui, mobile-first — giữ đúng luồng UX hiện tại (nhập nhanh, ví/lọ ghi nhớ, v.v.) |
| Biểu đồ | Chưa có | Recharts (nếu cần, theo CLAUDE.md §4) |

## 5. Xử lý rủi ro "project tạm ngưng sau 1 tuần không dùng"

Vì ứng dụng dùng hằng ngày nên rủi ro này thấp, nhưng để chắc chắn: thêm 1 tác vụ định kỳ (Vercel Cron, miễn phí trong hạn mức Hobby) gọi vào database mỗi vài ngày để giữ project "còn hoạt động". Không cần dịch vụ trả phí.

## 6. Các giai đoạn triển khai (làm từng bước, báo cáo sau mỗi giai đoạn — đúng CLAUDE.md §2.4)

| GĐ | Nội dung | Kết quả cần đạt |
|---|---|---|
| **0 — Chuẩn bị** | Tạo project Supabase + Vercel + repo GitHub mới; cấu hình biến môi trường; **không đụng tới hệ thống Apps Script đang chạy** | Hạ tầng rỗng sẵn sàng, hệ thống cũ không bị ảnh hưởng |
| **1 — Schema database** | Viết migration SQL cho toàn bộ 20 bảng (UUID, NUMERIC, index, ràng buộc), version-controlled theo CLAUDE.md §4.2/§5.4 | `DATABASE_SCHEMA.md` cập nhật cho Postgres; migration chạy được, rollback được |
| **2 — Lõi sổ cái + Auth + RLS** | Dựng lại cơ chế ghi nguyên tử (Entries→LiabilityEntries→Transactions), chặn sửa/xoá bằng trigger, đăng nhập Google, RLS theo quyền sở hữu (chung/cá nhân) | Ghi/đọc giao dịch đúng, 2 tài khoản đăng nhập độc lập, không truy cập được dữ liệu người khác qua query trực tiếp |
| **3 — Di chuyển dữ liệu** | Xuất toàn bộ dữ liệu hiện tại từ Google Sheets, nạp vào Postgres, đối soát số dòng + tổng tiền từng loại (đúng quy trình CLAUDE.md §9) | Báo cáo đối soát: số dòng khớp, tổng thu/chi/số dư ví khớp 100% giữa hệ cũ và hệ mới |
| **4 — Giao diện** | Dựng lại từng màn hình: Tổng quan, Thêm giao dịch, Danh sách, Ví, Ngân sách, Tài sản/Nợ, Sự kiện, Vàng, Sổ cưới, Admin | Dùng được đầy đủ như bản Apps Script, trên điện thoại và desktop |
| **5 — Kiểm thử** | Dịch 53 test case hiện có sang bộ test mới (Vitest + database test), bổ sung test cho Auth/RLS | Toàn bộ test đạt trước khi coi giai đoạn này xong |
| **6 — Chạy song song & đối chiếu** | Dùng thử hệ thống mới vài ngày–2 tuần, nhập liệu thật, đối chiếu số liệu với hệ thống cũ (vẫn giữ nguyên, chưa tắt) | Hai hệ thống cho cùng kết quả trong thời gian chạy song song |
| **7 — Chuyển chính thức** | Khi bạn xác nhận ổn, chuyển hẳn sang hệ mới; đóng (không xoá) Apps Script — giữ làm bản lưu trữ/tham khảo; thiết lập lại export CSV/Excel định kỳ từ hệ mới (CLAUDE.md §6.4) | Google Sheets không còn là nơi ghi dữ liệu sống, chỉ còn là lịch sử |

## 7. Rủi ro chính và cách giảm rủi ro

- **Viết lại sai một quy tắc nghiệp vụ đã chốt** → giảm bằng cách dùng 53 test hiện có làm đặc tả, không viết lại logic "theo trí nhớ".
- **Mất/lệch dữ liệu khi di chuyển** → đối soát số dòng + tổng tiền bắt buộc trước khi coi giai đoạn 3 xong, không tự ý bỏ qua dòng nào.
- **Thời gian thực hiện dài hơn các giai đoạn trước** → đây là một dự án viết lại toàn bộ, không phải một tính năng nhỏ; làm theo từng giai đoạn ở mục 6, báo cáo sau mỗi giai đoạn, không dồn thành một lần code lớn (đúng CLAUDE.md §2.4).
- **Trong thời gian chuyển đổi, Google Sheets vẫn phải tiếp tục dùng để ghi chép hằng ngày** — hệ thống cũ không bị động đến cho tới giai đoạn 7.

## 8. Việc cần bạn xác nhận trước khi bắt đầu Giai đoạn 0

1. Tốc độ thực hiện: làm liên tục từng giai đoạn, hay làm xen kẽ với các việc khác (vd tiếp tục thêm tính năng trên Apps Script trong lúc chờ)?
2. Có cần tối ưu tốc độ tạm thời trên hệ thống Apps Script hiện tại trong lúc chờ hoàn thành migrate (vài tuần), hay chấp nhận chịu chậm tới khi xong?
3. Tên domain: dùng domain mặc định `*.vercel.app`, hay bạn đã có domain riêng muốn gắn vào?
