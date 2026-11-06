# Các bước tiếp theo (sau khi setupSpreadsheet thành công)

Cập nhật 06/11/2026. Làm theo đúng thứ tự, đánh dấu ✅ sau mỗi bước. Mỗi bước có cách kiểm tra — chưa đạt thì đừng làm bước sau.

## 1. Điền thông tin cơ bản (trong Google Sheet dữ liệu)

Mở file Google Sheet `Family Finance - DATA` (ID: `1Hz3NkULK02lnx8OZNzYnlZIq0UIVW-seg2BMyKtLHCY`).

- [ ] Sheet **Members**: điền email Gmail thật của Cục Thịt và Cục Cá vào cột `email` (2 dòng có sẵn, chữ thường).
- [ ] Sheet **Wallets**: điền `opening_balance` (số dư thật tại ngày 01/11/2026) cho từng ví trong 8 ví. Đây là số bạn quyết định, không ai điền hộ được.
- [ ] Chia sẻ file này cho Cục Cá với quyền **Người chỉnh sửa**.

Kiểm tra: quay lại Apps Script, chạy hàm `checkSetup` → phải ra dòng **"Mọi thứ đã sẵn sàng."**

## 2. Chạy bộ kiểm thử tự động

- [ ] Trong Apps Script, chọn hàm `runAllTests` → Run.

Kiểm tra: mục **Nhật ký thực thi (Execution log)** hiện `TẤT CẢ ĐẠT: 37 đạt, 0 lỗi`. Hàm này tự tạo rồi tự xóa một file Google Sheet tạm để thử nghiệm — không đụng dữ liệu thật.

## 3. Phát hành (hoặc kiểm tra lại) ứng dụng web

Nếu bạn đã triển khai trước đó (lúc setup còn lỗi), nên **triển khai lại** một phiên bản mới để chắc chắn dùng đúng code hiện tại:

- [ ] **Triển khai → Quản lý các bản triển khai** → chọn bản ứng dụng web đã có → biểu tượng bút chì (Sửa) → **Phiên bản: Phiên bản mới** → **Triển khai**.
  (Nếu chưa từng triển khai: **Triển khai → Tùy chọn triển khai mới → Ứng dụng web** → Thực thi dưới dạng: *Người dùng đang truy cập ứng dụng web* → Ai có quyền truy cập: *Bất kỳ ai có Tài khoản Google* → Triển khai.)
- [ ] Chép URL ứng dụng web (kết thúc bằng `/exec`).
- [ ] Mở URL bằng tài khoản Cục Thịt → phải thấy màn hình Tổng quan.
- [ ] Mở URL bằng tài khoản Cục Cá (sau khi đã chia sẻ file ở bước 1) → lần đầu sẽ hỏi cấp quyền → thấy "Cục Cá" ở góc phải màn hình.
- [ ] Mở URL bằng một tài khoản Gmail khác (không phải 2 người trên) → phải bị từ chối.
- [ ] Trên điện thoại: mở URL → menu trình duyệt → **Thêm vào Màn hình chính** (để dùng như một app).

## 4. Bật sao lưu và kiểm tra tự động

- [ ] Chạy hàm `installTriggers` (một lần duy nhất). Tạo 4 việc chạy nền: kiểm tra hằng ngày (6h), sao lưu tuần (Chủ nhật 2h), xuất Excel hằng tháng (ngày 1, 3h), ghi nhận sửa tay.
- [ ] Chạy thử ngay `weeklyBackup` và `monthlyExport` → kiểm tra trong Google Drive có thư mục `Family Finance - Backup` chứa `Weekly` và `Monthly` với file bên trong.
- [ ] Cài **Google Drive for desktop** (https://www.google.com/drive/download/) trên máy nhà, đăng nhập tài khoản Cục Thịt, chọn đồng bộ thư mục `Family Finance - Backup` về máy. Đây là thao tác tay **duy nhất**, làm một lần; sau đó bản sao lưu tự động tải về máy mỗi tuần/tháng.
- [ ] (Tuỳ chọn) Chia sẻ thư mục sao lưu đó cho Cục Cá (quyền Xem).

Kiểm tra: sheet **Settings** trong Google Sheet có `last_backup_weekly` và `last_backup_monthly` kết thúc bằng `OK`.

## 5. Dùng thử ứng dụng vài ngày trước khi nhập dữ liệu cũ

- [ ] Mỗi người tự nhập vài giao dịch thật (thu, chi, chuyển ví) qua ứng dụng, xem số dư và ngân sách có đúng như kỳ vọng không.
- [ ] Nếu phát hiện sai gì (quy tắc, màn hình, công thức) — báo tôi trước khi nhập lượng lớn dữ liệu lịch sử.

## 6. Nhập dữ liệu lịch sử từ Excel cũ (việc này đã chuẩn bị sẵn)

32 nhóm danh mục mơ hồ **đã được bạn quyết định xong** (06/11/2026) và đã đưa sẵn vào code — bước này giờ chỉ còn thao tác kỹ thuật, không cần quyết định thêm:

- [ ] Tải `Appsheet_Finance.xlsx` (từ `D:\FAMILY_FINANCES\01_Source_Reports`) lên Google Drive.
- [ ] Mở file đó **bằng Google Trang tính** (chuột phải → Mở bằng → Google Trang tính) để có một file Google Sheet riêng. Chép ID file này (trên thanh địa chỉ).
- [ ] Trong Apps Script, mở file **Import.gs**, cuộn xuống **dòng cuối cùng**, thêm đúng 1 dòng này (thay ID vào chỗ ghi rõ), rồi **Lưu**:
  ```
  function importPrepareNow() { return importPrepare('DÁN_ID_FILE_GOOGLE_SHEET_VỪA_CHÉP_VÀO_ĐÂY'); }
  ```
  Chọn hàm `importPrepareNow` trên thanh công cụ → Run. (Dòng này chỉ để chạy 1 lần, sau đó có thể xóa đi, không ảnh hưởng gì nếu để lại.)
- [ ] Kiểm tra sheet `ImportMap` mới xuất hiện: cột `action` phải đã điền sẵn hết (không còn ô "review") — nếu bạn muốn đổi quyết định nào, sửa trực tiếp ở đây.
- [ ] Chạy `importDryRun` → xem sheet `ImportReport`: phải thấy "Đối chiếu số dòng và tổng tiền: KHỚP" cho cả finance và change, "chưa quyết định 0".
- [ ] Chạy `importRun` → ghi thật. Nếu báo "CÒN … chưa ghi", chạy `importRun` thêm lần nữa cho đến khi hết.
- [ ] Vào app → Thêm → Hệ thống → **Kiểm tra toàn vẹn ngay** → phải ra "Đạt".

## 7. Sau khi mọi thứ ổn định

- [ ] Dùng hằng ngày qua ứng dụng web (đã thêm vào màn hình chính điện thoại).
- [ ] Theo dõi email cảnh báo (ngân sách vượt, nhắc hóa đơn, báo lỗi toàn vẹn nếu có).
- [ ] Có gì bất thường hoặc muốn thêm tính năng — báo tôi, tôi sẽ sửa code, bạn chỉ cần `clasp.cmd push` lại.

---

*Ghi chú: mỗi lần tôi sửa code, quy trình luôn là: tôi cập nhật file trong `D:\FAMILY_FINANCES\03_AppsScript` → bạn vào thư mục đó, chạy `clasp.cmd push` → đóng/mở lại tab Apps Script → chạy lại hàm cần thiết. Không cần làm lại bước setupSpreadsheet trừ khi tôi nói rõ.*
