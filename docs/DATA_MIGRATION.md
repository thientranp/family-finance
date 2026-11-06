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

**Trạng thái: ĐÃ QUYẾT ĐỊNH (06/11/2026)** — bạn đã duyệt file `Ra_soat_giao_dich_chua_ro.xlsx`, quy tắc: ô để trống = bỏ qua (skip); phân loại được thì phân loại, còn lại bỏ qua; có thể điều chỉnh lại sau trực tiếp trong sheet `ImportMap`. Quyết định đã đưa vào code (`FF_IMPORT_DECISIONS` trong `Import.gs`) — khi chạy `importPrepare()` trên dữ liệu thật, các nhóm dưới đây tự động điền sẵn, không cần gõ lại tay.

| Loại | Danh mục | Số dòng | Tổng tiền (đ) | Quyết định |
|---|---|---|---|---|
| Chi | CT tower | 2 | 1.040.700.000 | skip |
| Thu | Tiết kiệm | 14 | 707.533.413 | skip |
| Thu | Gia đình | 4 | 536.330.000 | skip |
| Chi | Chứng khoán | 27 | 448.040.000 | skip |
| Thu | Chứng khoán | 9 | 298.521.701 | skip |
| Chi | Ô tô | 10 | 216.693.319 | skip |
| Thu | Thưởng | 44 | 180.501.072 | income → Thu khác |
| Chi | Tiết kiệm | 8 | 123.885.000 | skip |
| Chi | Điều chỉnh | 33 | 86.160.463 | skip |
| Thu | Điều chỉnh | 5 | 79.862.211 | skip |
| Thu | Cheppy | 49 | 38.750.000 | income → Thu khác |
| Chi | Coin | 2 | 30.000.000 | skip |
| Thu | Vending | 11 | 20.520.904 | income → Thu nhập chung (Vending, Coin) |
| Chi | Vending | 1 | 20.000.000 | skip |
| Thu | Khác | 7 | 19.635.999 | income → Thu khác |
| Chi | Trả góp | 9 | 18.818.401 | skip |
| Thu | Mượn tiền | 22 | 16.740.000 | skip |
| Chi | Gia đình | 3 | 10.950.000 | skip |
| Thu | Được tặng | 17 | 8.686.875 | income → Thu khác |
| Chi | Em - Ba | 15 | 8.204.130 | skip |
| Chi | Em - Mẹ | 8 | 7.632.000 | skip |
| Thu | Cưới hỏi | 2 | 2.300.000 | income → Thu khác |
| Thu | Kinh doanh | 16 | 4.770.000 | income → Thu khác |
| Chi | Thuê xe | 3 | 4.681.673 | expense → Di chuyển |
| Chi | Chi phí | 40 | 3.740.478 | skip |
| Chi | Em - Hùng | 3 | 1.756.680 | skip |
| Chi | Cho vay | 43 | 1.750.000 | skip |
| Thu | Lì xì | 9 | 1.720.000 | income → Thu khác |
| Thu | Họ hàng | 1 | 1.000.000 | income → Thu khác |
| Chi | Ba - Điện | 10 | 397.929 | expense → Hoá đơn điện |
| Chi | Phí thẻ | 5 | 335.293 | expense → Phí chung cư |
| Thu | Tiền lãi | 20 | 264.024 | income → Lãi tiết kiệm |

Các nhóm chi tiêu thông thường (Đi chợ, Ăn ngoài, Cà phê, Xăng dầu, …) tự động nhận diện theo bảng danh mục–lọ đã duyệt, không cần quyết định thêm.

**Kết quả chạy thử lại trên dữ liệu thật sau khi áp dụng quyết định trên:** 4.245 dòng finance + 369 dòng chuyển ví nhập được (1,88 tỷ đ), 259 dòng bị bỏ qua có chủ đích (3,66 tỷ đ, các khoản đầu tư/tiết kiệm/vay mượn/đối soát/mua tài sản lớn như CT tower), 0 dòng còn "chưa quyết định", 0 lỗi, đối chiếu số dòng và tổng tiền khớp tuyệt đối.

Nếu sau này muốn sửa lại một quyết định nào (ví dụ đổi "CT tower" từ skip sang ghi nhận là tài sản riêng), sửa trực tiếp cột `action`/`target_category` trong sheet `ImportMap` rồi chạy lại `importDryRun()` → `importRun()`.

## Cập nhật quyết định — 07/11/2026

Sau khi rà lại từng dòng gốc (không chỉ dựa tên mục), các dòng "skip" sau trong bảng trên **đã được xem lại và đổi quyết định**: CT tower, Điều chỉnh (Chi+Thu), Tiết kiệm (Chi+Thu), Chứng khoán (Chi+Thu), Trả góp, Ô tô, Chi phí, Phí thẻ. Quyết định mới cho từng nhóm — xem đầy đủ lý do và số liệu chi tiết ở mục "Nhập dữ liệu lịch sử — các nhóm còn mơ hồ (quyết định 07/11/2026)" trong `BUSINESS_RULES.md`. "Cho vay"/"Mượn tiền" **vẫn giữ skip** (lý do đổi khác: 85% dòng không có số tiền thật, không phải vì chưa rõ bản chất).

**Lưu ý kỹ thuật quan trọng:** nhóm "Điều chỉnh" ban đầu định dùng nghiệp vụ "đối soát số dư ví" (`adjustment`), nhưng nghiệp vụ này **chặn mọi ngày trước ngày bắt đầu của ví** — mà toàn bộ dữ liệu lịch sử (2022–2025) đều trước ngày bắt đầu ví thật (01/11/2026). Vì vậy đã đổi sang nhập như chi tiêu/thu nhập lịch sử bình thường dưới 2 danh mục mới riêng (xem danh sách dưới).

**Trạng thái: CHƯA THỰC HIỆN.** Việc tạo các đối tượng mới trước khi import gồm:
- Ví mới (loại `savings`): "Tiết kiệm - Cục Cá", "SSI - Chứng khoán", "Pinetree - Chứng khoán", "Entrade - Chứng khoán".
- Danh mục chi tiêu mới: "Phí ngân hàng & thẻ", "Phí hành chính - giấy tờ", "Trả nợ vay cũ (đã tất toán)", "Đối soát cũ (lịch sử) - thiếu hụt" (thay cho `adjustment`, xem lưu ý trên).
- Danh mục thu nhập mới: "Thu nhập Vending" (giữ như cũ, không đổi), "Đối soát cũ (lịch sử) - phát sinh" (thay cho `adjustment`, xem lưu ý trên).
- Tài sản mới: "Nhà - CT Tower" (loại Nhà, 1.040.700.000đ), "Xe Cx3" (loại Xe, **600.000.000đ** — giá mua đầy đủ, đã sửa lại sau khi bạn xác nhận; không phải 190.000.000đ là số tiền trả trước), "Máy bán nước tự động" (loại Khác, 20.000.000đ).
- Khoản vay mới: "Vay mua xe Cx3" — dư nợ ban đầu = **410.000.000đ** (600tr giá xe − 190tr trả trước, theo số bạn xác nhận), ngày bắt đầu nên đặt 22/01/2025 (ngày vay thực tế theo `oto.xlsx`) để các kỳ trả góp sau đó không bị chặn bởi ngày bắt đầu khoản vay.

Sau khi các đối tượng trên có trong hệ thống, sẽ cập nhật `FF_IMPORT_DECISIONS`/`FF_IMPORT_ROW_OVERRIDES` trong `Import.gs` để trỏ đúng `target_category`/ví/tài sản/khoản vay, chạy lại `importDryRun()` → `importRun()`, rồi đối chiếu lại tổng tiền + chạy kiểm tra toàn vẹn.

Riêng 19/23 kỳ trả góp xe trong `oto.xlsx` **không có trong sheet `finance` gốc** (chỉ 4 kỳ đầu + tiền trả trước được ghi) — sẽ nhập bằng một bước riêng (không qua `ImportMap`), trừ từ ví "Vietinbank - Cục Thịt" vào khoản vay "Vay mua xe Cx3", sau khi khoản vay đã tồn tại.
