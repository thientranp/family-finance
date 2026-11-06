# Hướng dẫn triển khai Family Finance (Google Sheets + Apps Script)

Làm trên **máy cá nhân ở nhà**, đăng nhập bằng **tài khoản Google của Cục Thịt** (chủ dữ liệu). Mất khoảng 45–60 phút. Mỗi bước có "Kiểm tra" — chưa đạt thì dừng lại, đừng làm tiếp.

> Dữ liệu thật của gia đình chỉ nằm trong Google Sheet của bạn. Không đưa dữ liệu thật lên GitHub.

## Danh sách file cần dán (12 file)

| # | Tên trong Apps Script | Loại | Lấy từ |
|---|---|---|---|
| 1 | Core | Script (.gs) | apps-script/Core.gs |
| 2 | Ledger | Script | apps-script/Ledger.gs |
| 3 | Budget | Script | apps-script/Budget.gs |
| 4 | Assets | Script | apps-script/Assets.gs |
| 5 | Reports | Script | apps-script/Reports.gs |
| 6 | Config | Script | apps-script/Config.gs |
| 7 | Admin | Script | apps-script/Admin.gs |
| 8 | Api | Script | apps-script/Api.gs |
| 9 | Import | Script | apps-script/Import.gs |
| 10 | Tests | Script | apps-script/Tests.gs |
| 11 | Index | HTML | apps-script/Index.html |
| 12 | appsscript.json | Manifest | apps-script/appsscript.json |

Mỗi lần cập nhật, tôi sẽ ghi rõ "thay file nào". Chạy `showVersions()` để xem phiên bản đang dán.

## Bước 1 — Tạo file dữ liệu
1. Vào https://drive.google.com → **Mới → Google Trang tính** → đặt tên `Family Finance - DATA`.
2. Lấy **ID** của file: trong thanh địa chỉ `https://docs.google.com/spreadsheets/d/`**`ID_NẰM_Ở_ĐÂY`**`/edit`. Chép lại.
3. **Chia sẻ** file cho Cục Cá với quyền **Người chỉnh sửa** (cần để chị ấy nhập được).

Kiểm tra: cả hai tài khoản đều mở được file.

## Bước 2 — Tạo dự án Apps Script (độc lập, không gắn vào Sheet)
1. Vào https://script.google.com → **Dự án mới**. Đặt tên `Family Finance`.
2. **Cài đặt dự án** (bánh răng) → bật **Hiển thị tệp kê khai "appsscript.json" trong trình chỉnh sửa**.
3. Cũng trong Cài đặt dự án → **Thuộc tính tập lệnh** → **Thêm thuộc tính**: tên `SS_ID`, giá trị là ID ở bước 1.
4. Trong trình chỉnh sửa: mở `appsscript.json`, xóa nội dung cũ, dán nội dung file `appsscript.json`.
5. Với mỗi file #1–#10: **+ → Tập lệnh**, đặt tên đúng bảng trên (không gõ đuôi .gs), xóa nội dung mặc định, dán nội dung. Với #11: **+ → HTML**, tên `Index`. File `Code.gs` mặc định có thể xóa.
6. Bấm **Lưu**.

Kiểm tra: chạy hàm `showVersions` (chọn hàm ở thanh trên → Chạy). Lần đầu Google hỏi quyền: **Xem xét quyền → chọn tài khoản → Nâng cao → Đi tới Family Finance (không an toàn) → Cho phép**. (Cảnh báo này bình thường vì script do chính bạn viết.) Nhật ký hiện danh sách phiên bản 0.3.0.

## Bước 3 — Khởi tạo bảng
1. Chạy hàm `setupSpreadsheet`. Chờ "Đã thiết lập".
2. Mở file DATA: sẽ có các sheet Members, Wallets, Jars, Categories, Budgets, Transactions, Entries, Assets, Liabilities, … Các sheet sổ cái (Transactions, Entries, LiabilityEntries, AuditLog) có cảnh báo khi sửa tay — **đừng sửa tay**.
3. Sheet **Members**: ô `email` của 2 dòng, điền Gmail của Cục Thịt và Cục Cá (chữ thường).
4. Sheet **Wallets**: kiểm tra 8 ví; điền `opening_balance` (số dư đầu kỳ tại ngày 01/11/2026) cho từng ví theo số thật (số nguyên, đồng). Đây là việc bạn quyết định, tôi không điền hộ.

Kiểm tra: chạy `checkSetup` → "Mọi thứ đã sẵn sàng."

## Bước 4 — Chạy bộ kiểm thử (an toàn)
Chạy hàm `runAllTests`. Hàm tạo file tạm trong Drive, thử hơn 35 tình huống (thu, chi, chuyển ví, đảo, ngân sách, nợ, sao lưu, phân quyền…), rồi xóa file tạm. Không động vào dữ liệu thật, không gửi mail thật.

Kiểm tra: Nhật ký (Execution log) hiện `TẤT CẢ ĐẠT: … 0 lỗi`. Nếu có dòng `THẤT BẠI`, chụp màn hình gửi tôi.

## Bước 5 — Phát hành web app
1. **Triển khai → Tùy chọn triển khai mới → Ứng dụng web**.
2. Mô tả `v0.3.0`. **Thực thi dưới dạng: Người dùng đang truy cập ứng dụng web**. **Ai có quyền truy cập: Bất kỳ ai có Tài khoản Google**.
3. **Triển khai** → cho phép quyền nếu được hỏi → chép **URL ứng dụng web** (kết thúc bằng `/exec`).
4. Mở URL bằng tài khoản Cục Thịt: phải thấy màn hình Tổng quan. Mở bằng tài khoản Cục Cá (lần đầu sẽ hỏi cấp quyền): thấy "Cục Cá" ở góc phải. Mở bằng tài khoản Gmail lạ: phải bị từ chối.
5. Trên điện thoại: mở URL → menu trình duyệt → **Thêm vào màn hình chính**.

**Điểm cần xác minh thật (tôi chưa thử được trên Google):** ứng dụng nhận ra tài khoản đang đăng nhập (`Session.getActiveUser().getEmail()`). Chạy `whoAmI` trong editor và mở web app bằng cả hai tài khoản. Nếu hiện "Không xác định được tài khoản Google", báo tôi — tôi có phương án dự phòng.

## Bước 6 — Bật sao lưu và kiểm tra tự động
1. Chạy `installTriggers` (một lần). Hàm tạo 4 trigger: kiểm tra hằng ngày 6h (nhắc nhở + toàn vẹn), sao lưu tuần (CN 2h), xuất Excel tháng (ngày 1, 3h), ghi nhận sửa tay.
2. Chạy thử ngay `weeklyBackup` và `monthlyExport`: trong Drive có thư mục `Family Finance - Backup` với `Weekly` và `Monthly`.
3. **Tự động về máy**: cài *Google Drive for desktop* (https://www.google.com/drive/download/) trên máy nhà, đăng nhập tài khoản Cục Thịt, chọn đồng bộ (stream hoặc mirror) thư mục `Family Finance - Backup`. Đây là bước duy nhất làm tay một lần; sau đó bản sao lưu tự về máy.
4. Chia sẻ thư mục sao lưu với Cục Cá (Người xem) nếu muốn chị ấy cũng có bản.

Kiểm tra: sau khi chạy, sheet **Settings** có `last_backup_weekly` và `last_backup_monthly` kết thúc bằng `OK`.

## Bước 7 — Nhập dữ liệu lịch sử từ Excel (không bắt buộc, làm sau cùng)
Xem `docs/DATA_MIGRATION.md`. Tóm tắt: tải `Appsheet_Finance.xlsx` lên Drive → mở bằng Google Trang tính → chép ID → chạy `importPrepare('ID')` → quyết định các nhóm danh mục trong sheet `ImportMap` → `importDryRun()` → `importRun()`.

## Khi có lỗi
- "Hệ thống đang bận": hai người bấm lưu cùng lúc; thử lại sau vài giây.
- Thư mục sao lưu không tăng: xem sheet AuditLog dòng `backup:*` và email cảnh báo.
- Email cảnh báo "toàn vẹn": có ai sửa tay sheet sổ cái, hoặc dữ liệu lệch. Mở **Thêm → Hệ thống** trong app để xem chi tiết; **đừng tự sửa**, hãy gửi tôi.
- Khôi phục: mở bản sao tuần gần nhất trong Drive, kiểm tra, rồi đổi `SS_ID` sang ID của bản đó (hoặc sao chép lại dữ liệu).
