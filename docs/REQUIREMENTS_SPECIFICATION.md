# Requirements Specification — Family Finance

- **Phiên bản:** 1.1
- **Ngày cập nhật:** 06/11/2026
- **Trạng thái:** v1.0 đã phê duyệt (05/11/2026). v1.1: đổi nền tảng sang Google Sheets + Apps Script theo quyết định của người dùng (06/11/2026); nghiệp vụ không đổi. Implementation Plan: xem `IMPLEMENTATION_PLAN.md` (v0.3).
- **Nguồn:** giai đoạn khảo sát và phỏng vấn (doc "Khảo sát ban đầu"), file `Appsheet_Finance.xlsx`, file trong `01_Source_Reports`.

Quy ước trạng thái: **Confirmed** (đã chốt), **Proposed** (đề xuất, chưa xác nhận), **Pending** (chưa quyết định), **Deferred** (hoãn).

---

## 1. Mục tiêu và người dùng

- Hệ thống quản lý tài chính gia đình cho **Cục Thịt** (chồng) và **Cục Cá** (vợ).
- Mỗi người có tài khoản Google riêng và đăng nhập độc lập. Không dùng tài khoản chung.
- Chỉ hai người này truy cập được dữ liệu gia đình (REQ-001).
- Mục tiêu: thu chi, ngân sách chia lọ, nhiều ví, chuyển tiền nội bộ, điều chỉnh số dư, tài sản và công nợ, nhắc nhở, báo cáo, import Excel cũ, backup.
- Chi phí vận hành mục tiêu: 0 đồng (REQ-011).
- Ngôn ngữ giao diện: tiếng Việt. Tên hiển thị giữ nguyên: "Cục Thịt", "Cục Cá".

## 2. Mô hình tài chính

| ID | Nội dung | Trạng thái |
|---|---|---|
| REQ-013 | Mỗi người có ví cá nhân. Lương vào ví riêng, ghi một thu nhập mỗi tháng. | Confirmed |
| REQ-013a | Không có mức đóng góp cố định vào quỹ chung. Cục Cá quyết định số tiền chuyển vào quỹ theo nhu cầu. | Confirmed |
| REQ-013b | Chuyển tiền từ ví cá nhân vào quỹ gia đình là chuyển khoản nội bộ, không tính là thu chi (REQ-006). | Confirmed |
| REQ-013c | Không có ví chung riêng. Tiền mặt gia đình dùng ví cá nhân làm nguồn. | Confirmed |
| REQ-017 | Tiết kiệm và vàng là **100% tài sản chung**. | Confirmed |
| REQ-018 | Ví Beo là ví **giữ hộ** cho người thứ ba. Loại đặc biệt "Giữ hộ", có tên người gửi. Không tính vào thu chi và tài sản gia đình. Hiển thị như khoản phải trả lại. Ví Beo đã đóng. | Confirmed |

## 3. Ví, số dư và chuyển tiền

| ID | Nội dung | Trạng thái |
|---|---|---|
| REQ-004 | Nhiều ví, dùng WalletID duy nhất. Không dùng tên làm khóa liên kết. | Confirmed |
| REQ-015 | Danh mục ví lấy theo Excel (xem bảng dưới), có thể thêm. | Confirmed |
| REQ-006 | Chuyển tiền giữa ví là giao dịch nguyên tử, không tính là thu chi, chống ghi trùng. | Confirmed |
| REQ-007 | Điều chỉnh số dư: âm giảm, dương tăng. Bắt buộc có lý do, người thực hiện, thời gian, số trước và sau. Không sửa hoặc xóa giao dịch cũ. | Confirmed |
| REQ-020 | Ngày cắt số dư: **01/11/2026**. Nhập số dư thực tế từng ví tại ngày này. | Confirmed |
| REQ-021 | Lịch sử cũ (12/2022 – 07/08/2025) import để báo cáo, không ảnh hưởng số dư hiện tại. | Confirmed |
| REQ-022 | Giao dịch 08/2025 – 31/10/2026: người dùng nhập lại phần nhớ được. Phần còn thiếu xử lý bằng điều chỉnh số dư. | Confirmed |

**Danh mục ví ban đầu (theo Excel):**

| WalletID | Tên ví (Excel) | Loại | Chủ sở hữu | Trạng thái |
|---|---|---|---|---|
| W001 | Ví - Cục Thịt | Ví tiền mặt | Cục Thịt | Đang dùng |
| W002 | VÍ - Cục Cá | Ví tiền mặt | Cục Cá | Đang dùng |
| W003 | BIDV - Cục Cá | BIDV | Cục Cá | Đang dùng |
| W004 | BIDV - Cục Thịt | BIDV | Cục Thịt | Đang dùng |
| W005 | Vietinbank - Cục Thịt | Vietinbank | Cục Thịt | Đang dùng |
| W006 | Vietinbank - Cục Cá | Vietinbank | Cục Cá | Đang dùng |
| W007 | HSBC | HSBC | Cục Thịt | Đang dùng |
| W008 | Beo | Giữ hộ | Cục Thịt (giữ hộ) | Đã đóng |

*Ghi chú: "Đang dùng" là giả định, chưa xác nhận từng ví. Trước khi nhập số dư, cần xác nhận lại.*

**Tiết kiệm Vietinbank:** người dùng có thể chi 100 triệu từ ví Vietinbank - Cục Thịt để gửi sang ngân hàng khác lấy lãi cao hơn. Trạng thái: Confirmed (REQ-035). Tài khoản tiết kiệm là loại ví `savings`: chuyển vào là chuyển khoản nội bộ, tính vào tài sản, không tính vào tiền khả dụng (06/11/2026).

## 4. Ngân sách 6 lọ

| ID | Nội dung | Trạng thái |
|---|---|---|
| REQ-002 | Ngân sách theo tháng, số tiền cố định, kế thừa tháng trước, không đổi lịch sử. | Confirmed |
| REQ-016 | Mô hình lai: 6 lọ cố định bằng số tiền, quy tắc phong bì (hết lọ thì không chi thêm), rà soát hằng tháng kiểu Kakeibo. | Confirmed |
| REQ-016a | Chi chia thành **6 lọ**. Thu gom thành vài nhóm, có thể tùy chỉnh thêm. | Confirmed |
| REQ-022a | Tên 6 lọ: Thiết yếu, Ăn uống ngoài, Xe và di chuyển, Gia đình và con, Cá nhân và vui chơi, Cho đi và xã hội. | Confirmed |
| REQ-003 | Số tiền từng lọ: dùng số gợi ý trung bình 23,45 triệu/tháng (dữ liệu 01/2023–07/2025) làm tạm. Người dùng sẽ điều chỉnh sau khi hệ thống xong. Danh mục thuộc từng lọ: xem bảng bên dưới. | Confirmed (số tiền tạm, điều chỉnh sau) |
| REQ-023 | Chuyển ngân sách giữa các lọ: được phép, có lịch sử, không tính là chi tiêu. | Confirmed |
| REQ-024 | Chi vượt lọ: vẫn ghi nhận, hiện cảnh báo và đánh dấu vượt. | Confirmed |
| REQ-019 | Ngoài 6 lọ, tách riêng: đầu tư, tiết kiệm, chứng khoán, ô tô (phần mua/vay), nhà (mua nhà), trả góp, cho vay. | Proposed |

**Phân loại Excel đề xuất vào lọ (chờ chốt số tiền):**

| Lọ | Danh mục Excel đề xuất |
|---|---|
| Thiết yếu | Đi chợ, Siêu thị, Hoá đơn điện, Internet, Thuốc, Khám bệnh, Phí chung cư, Đồ dùng gia đình, Thuê nhà, Gas |
| Ăn uống ngoài | Ăn ngoài, Cà phê, Trà sữa |
| Xe và di chuyển | Xăng dầu, Gửi xe, Grab, Di chuyển, Xe máy, Sửa chữa nhà, chi phí vận hành ô tô |
| Gia đình và con | Cheppy, Khám thai, Trang phục, Giáo dục |
| Cá nhân và vui chơi | Du lịch, Làm đẹp, Mỹ phẩm, Giải trí, Thể thao, Điện thoại, Netflix |
| Cho đi và xã hội | Lì xì, Đi đám, Đồ cúng, Từ thiện, Cưới hỏi, Bạn bè, BIH, EIU |

## 5. Thu nhập, chi tiêu và ghi chép

| ID | Nội dung | Trạng thái |
|---|---|---|
| REQ-025 | Vending và Coin: khoản thu khi vận hành tính là **thu nhập chung** của gia đình. Khoản chi đầu tư nằm ngoài 6 lọ (REQ-019). | Confirmed |
| REQ-026 | BIH và EIU (thu chi với đồng nghiệp): thuộc lọ Cho đi và xã hội. Khoản thu hoàn lại ghi vào cùng lọ để bù trừ. | Confirmed |
| REQ-027 | Mỗi bản ghi chi có ghi chú mô tả khoản chi, không cần bảng chi tiết từng món. | Confirmed |
| REQ-028 | Mỗi giao dịch tối thiểu có: số tiền, lọ, ví, người chi, ghi chú, ngày. | Proposed |
| REQ-029 | Ô tô: phần mua và vay là tài sản và nợ (theo dõi đã trả và dư nợ). Phần xăng, bảo dưỡng là chi phí vận hành, đưa vào lọ Xe và di chuyển. | Confirmed |
| REQ-030 | Chi phí trả trước (bảo dưỡng, bảo hiểm, phí): ghi chi ngay khi trả tiền, không phân bổ theo tháng. | Confirmed |

## 6. Tài sản, khoản vay và định giá

| ID | Nội dung | Trạng thái |
|---|---|---|
| REQ-019a | Nhà (CT tower) là khoản mua nhà, tách khỏi các lọ sinh hoạt. | Confirmed |
| REQ-031 | Khoản vay xe: ghi tổng số tiền mỗi kỳ, dư nợ theo số liệu ngân hàng. Không tách gốc và lãi. | Confirmed |
| REQ-032 | Mua xe kèm khoản vay của chủ cũ: giá 600 triệu, trả trước 190 triệu cho chủ cũ (22/01/2025), vay 410 triệu theo người dùng. | Confirmed |
| REQ-033 | Dư nợ ngân hàng suy ra khi nhận xe: 430.752.401 đ. Chênh lệch 20.752.401 đ ghi là **điều chỉnh đối soát dư nợ** tăng, lý do chưa rõ, chờ đối chiếu. Không phải chi tiêu. | Confirmed |
| REQ-034 | Không định giá lại tài sản (nhà, xe). Tài sản ghi theo giá mua. Khi bán, ghi nhận thu. | Confirmed |
| REQ-035 | Tiết kiệm gửi ngân hàng khác là **tài khoản tài sản riêng**. Tiền chuyển từ ví sang tài khoản này. Tiền lãi là thu nhập. | Confirmed |

Công thức:
- Dư nợ sau kỳ = dư nợ trước kỳ − số tiền trả + điều chỉnh (nếu có).
- Tài sản ròng = tổng tài sản (theo giá mua, gồm tiết kiệm và vàng) − tổng nợ. *Cách tính này do REQ-034 suy ra, cần người dùng xác nhận khi phê duyệt.*

## 7. Import dữ liệu Excel

| ID | Nội dung | Trạng thái |
|---|---|---|
| REQ-008 | Import toàn bộ dữ liệu, không ghi đè file gốc, không import trùng. | Confirmed |
| REQ-008a | Mapping từ Excel sang dữ liệu mới, có kiểm tra số dòng và đối soát tổng tiền sau import. | Confirmed |

**Số dòng đã kiểm tra:** finance 4.504; change 369; wedding 487; setting 72; cheppy_newborn 39; saving 9; gold 9; event 8; report 8.

**Các điểm cần xử lý khi import:**
- Mục "Điều chỉnh" (38 dòng, 166.022.674 đ) không tự động là chi tiêu.
- Danh mục lệch giữa finance và setting (5 cặp không có trong setting, 3 mục không dùng).
- Tên ví không thống nhất về chữ hoa.
- Cột "Sự kiện" trong finance chứa ID, không phải tên.
- Sheet saving, gold không có cột chủ sở hữu.
- Sheet wedding: cột Vàng và USD cần làm rõ đơn vị.

## 8. Dashboard và nhắc nhở

| ID | Nội dung | Trạng thái |
|---|---|---|
| REQ-009 | Dashboard: tổng thu chi, chi theo danh mục, ngân sách, số dư và tài sản. | Confirmed |
| REQ-009a | Chỉ hiển thị chỉ số có công thức đã duyệt. | Confirmed |
| REQ-010 | Nhắc nhở: điện, nước, internet, học phí, vay và thẻ tín dụng, định kỳ, nhắc nhập liệu, vượt ngân sách. Bật tắt từng loại. | Confirmed |
| REQ-010a | Kênh thông báo: email (MailApp, tối đa 100 người nhận/ngày) và thông báo trong ứng dụng. Không có thông báo đẩy. | Confirmed (06/11/2026) |

## 9. Công nghệ, bảo mật và backup

| ID | Nội dung | Trạng thái |
|---|---|---|
| REQ-011 | Ưu tiên miễn phí, mục tiêu 0 đồng. Cơ sở dữ liệu là Google Sheets. Cấu trúc sheet có phiên bản, thay đổi qua script nâng cấp. Export CSV và Excel từng sheet. Backup và phục hồi. | Confirmed (đổi 06/11/2026, trước: PostgreSQL chuẩn) |
| REQ-012 | Google Sheets (dữ liệu), Google Apps Script (nghiệp vụ và web app, HTML + Tailwind CSS), GitHub (mã nguồn, chép dán thủ công lên Apps Script). Không PWA. Thiết kế giao diện theo skill UI UX Pro Max. | Confirmed (06/11/2026, hạn mức cần xác minh ở giai đoạn 0) |
| REQ-036 | Bảo mật: file dữ liệu chỉ chia sẻ cho email của hai thành viên; script từ chối email ngoài danh sách; chủ sở hữu là tài khoản Google cá nhân của Cục Thịt; không đưa ID file và dữ liệu thật lên GitHub. Sửa tay trên file được phát hiện và ghi nhật ký, không chặn được (người dùng chấp nhận). | Confirmed (06/11/2026) |
| REQ-037 | Backup tự động: bản sao file hằng tuần (giữ 8 bản), file Excel hằng tháng (giữ 24 bản) đồng bộ về laptop qua Google Drive for desktop, kiểm tra sau mỗi lần sao lưu, có quy trình khôi phục. Không mã hóa trên Drive. | Confirmed (06/11/2026) |

## 10. Quyết định đã xác nhận (tổng hợp)

Các quyết định Confirmed ở trên là nguồn chính. Các quyết định Proposed cần người dùng xác nhận khi phê duyệt tài liệu này.

## 11. Còn thiếu trước khi triển khai

1. **REQ-003:** số tiền từng lọ (người dùng sẽ chỉnh sau khi hệ thống xong).
2. **REQ-020 / số dư ví:** số dư từng ví tại 01/11/2026 (người dùng nhập sau).
3. **REQ-022:** nhập lại các giao dịch 08/2025 – 31/10/2026 (người dùng nhập một phần).
4. Kiểm tra hạn mức miễn phí của Apps Script trên trang chính thức của Google (giai đoạn 0).
5. Xác nhận lại ví "Đang dùng" trong mục 3.
6. Xác nhận công thức tài sản ròng ở mục 6.

## 12. Rủi ro

- **Dữ liệu 08/2025 – 10/2026 thiếu:** số dư tính sai nếu không nhập đủ. Xử lý bằng điều chỉnh đối soát.
- **Chênh lệch khoản vay 20,75 triệu:** nguyên nhân chưa rõ. Có thể liên quan lãi hoặc số liệu chủ cũ.
- **Hạn mức miễn phí:** chưa kiểm tra. Có thể phát sinh chi phí nếu vượt.
- **Số liệu chi tiêu lịch sử:** có năm chi cao, có khoản lớn chiếm tỷ trọng (nhà 38%, chứng khoán 16%). Ngân sách 6 lọ cần điều chỉnh theo nhu cầu hiện tại.

## 13. Bước tiếp theo

1. Người dùng xem và phê duyệt tài liệu này (hoặc yêu cầu sửa).
2. Sau khi phê duyệt: viết Implementation Plan.
3. Kiểm tra hạn mức miễn phí thực tế trước khi chọn dịch vụ.
4. Chưa bắt đầu code cho đến khi có Implementation Plan được duyệt.
