# Nhập dữ liệu lịch sử (Appsheet_Finance.xlsx)

File gốc **không bao giờ bị sửa** (chỉ đọc). Phạm vi: sheet `finance` (4.504 dòng, 01/12/2022–07/08/2025) và `change` (369 dòng chuyển ví). Các sheet `setting`, `report`, `event`, `saving`, `gold`, `wedding`, `cheppy_newborn` **chưa nhập** (không phải giao dịch; cần quyết định riêng).

## Nguyên tắc
- Dữ liệu cũ là **lịch sử để báo cáo**: ngày nhập trước ngày bắt đầu của ví (01/11/2026) nên **không làm thay đổi số dư hiện tại**.
- Mỗi dòng có mã chống trùng `imp:finance:<ID>` / `imp:change:<ID>`: chạy lại nhiều lần không nhân đôi.
- Nhóm danh mục chưa rõ bản chất **bị chặn** cho đến khi bạn chọn `expense` / `income` / `skip` trong sheet `ImportMap`.
- Dòng số tiền 0 đ tự bỏ qua (không có tác động tài chính; 59 dòng).
- Tên ví khác hoa/thường ("VÍ - Cục Cá") tự khớp.
- Báo cáo đối chiếu số dòng và tổng tiền: nhập + bỏ qua + chưa quyết định + lỗi = nguồn.

## Quy trình
1. Tải xlsx lên Drive, mở bằng Google Trang tính, chép ID.
2. Chạy `importPrepare('ID')` → tạo sheet `ImportMap`.
3. Điền cột `action` (và `target_category` nếu `income`/`expense` vào danh mục có sẵn). Danh mục đích phải đã tồn tại trong app.
4. `importDryRun()` → xem sheet `ImportReport`. Phải: không còn `review`, không có lỗi, đối chiếu KHỚP.
5. `importRun()` (mỗi lượt ghi tối đa 600; chạy lại đến khi hết "CÒN … chưa ghi").
6. Chạy kiểm tra toàn vẹn trong app (Thêm → Hệ thống). Bạn duyệt báo cáo rồi mới coi là xong.

## Kết quả chạy thử trên máy giả lập (dữ liệu thật, không lưu lên GitHub)
- 4.051 dòng finance + 369 chuyển ví nhập được sau khi quyết định xong; 0 lỗi; thời gian ghi dưới 1 giây trên giả lập (Google thật chậm hơn nhưng nằm trong giới hạn nhờ chia lô).
- 452 dòng (3,94 tỷ đ) thuộc **32 nhóm** đang chờ bạn quyết định (bảng dưới). Tôi **không tự quyết**; cột "Gợi ý" chỉ để tham khảo.

| Loại | Danh mục | Số dòng | Tổng tiền (đ) | Gợi ý (cần bạn xác nhận) |
|---|---|---|---|---|
| Chi | CT tower | 2 | 1.040.700.000 | skip: có vẻ là mua bất động sản, thuộc tài sản chứ không phải chi tiêu |
| Thu | Tiết kiệm | 14 | 707.533.413 | skip: rút tiền tiết kiệm = chuyển ví |
| Thu | Gia đình | 4 | 536.330.000 | ? thu thật hay chuyển/cho tặng |
| Chi | Chứng khoán | 27 | 448.040.000 | skip: đầu tư, không phải chi tiêu |
| Thu | Chứng khoán | 9 | 298.521.701 | skip hoặc income (lãi/bán) |
| Chi | Ô tô | 10 | 216.693.319 | ? mua xe (tài sản) hay chi phí xe |
| Thu | Thưởng | 44 | 180.501.072 | income |
| Chi | Tiết kiệm | 8 | 123.885.000 | skip: gửi tiết kiệm = chuyển ví |
| Chi | Điều chỉnh | 33 | 86.160.463 | skip: chênh lệch đối soát, không phải chi tiêu |
| Thu | Điều chỉnh | 5 | 79.862.211 | skip |
| Thu | Cheppy | 49 | 38.750.000 | income (tiền mừng/quà?) |
| Chi | Coin | 2 | 30.000.000 | skip: đầu tư |
| Thu | Vending | 11 | 20.520.904 | income |
| Chi | Vending | 1 | 20.000.000 | ? vốn kinh doanh |
| Thu | Khác | 7 | 19.635.999 | income |
| Chi | Trả góp | 9 | 18.818.401 | skip: trả nợ, không phải chi tiêu |
| Thu | Mượn tiền | 22 | 16.740.000 | skip: tiền vay, không phải thu nhập |
| Chi | Gia đình | 3 | 10.950.000 | ? |
| Thu | Được tặng | 17 | 8.686.875 | income |
| Chi | Em - Ba | 15 | 8.204.130 | ? chi cho gia đình bên vợ: chi tiêu (lọ Cho đi) hay bỏ qua |
| Chi | Em - Mẹ | 8 | 7.632.000 | ? như trên |
| Thu | Cưới hỏi | 2 | 2.300.000 | income |
| Thu | Kinh doanh | 16 | 4.770.000 | income |
| Chi | Thuê xe | 3 | 4.681.673 | expense (Xe và di chuyển) |
| Chi | Chi phí | 40 | 3.740.478 | ? chung chung |
| Chi | Em - Hùng | 3 | 1.756.680 | ? |
| Chi | Cho vay | 43 | 1.750.000 | skip: cho vay không phải chi tiêu |
| Thu | Lì xì | 9 | 1.720.000 | income |
| Thu | Họ hàng | 1 | 1.000.000 | income |
| Chi | Ba - Điện | 10 | 397.929 | ? |
| Chi | Phí thẻ | 5 | 335.293 | expense (Thiết yếu) |
| Thu | Tiền lãi | 20 | 264.024 | income (Lãi tiết kiệm) |

Các nhóm chi tiêu thông thường (Đi chợ, Ăn ngoài, Cà phê, Xăng dầu, …) đã được đề xuất tự động theo bảng danh mục–lọ đã duyệt.
Nếu muốn một số nhóm thành chi tiêu thật, cần có danh mục đích: tạo trong app (Thêm → Danh mục) trước khi điền `ImportMap`.
