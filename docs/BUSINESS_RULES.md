# Quy tắc nghiệp vụ đã cài đặt (v0.3)

Trạng thái: **ĐÃ DUYỆT** = bạn đã xác nhận; **GIẢ ĐỊNH** = tôi chọn mặc định hợp lý, cần bạn xác nhận (mục cuối tài liệu).

## Sổ cái
- Số tiền là số nguyên dương (đồng); không dùng số thực. Từ chối 0, âm, số lẻ, chữ. [ĐÃ DUYỆT]
- Giao dịch đã ghi không sửa/xóa. Sửa sai bằng **bút toán đảo** (hôm nay), giữ giao dịch gốc; không đảo hai lần, không đảo bút toán đảo. [ĐÃ DUYỆT]
- Mã chống trùng (idempotency key): gửi lại cùng giao dịch không ghi lần hai.
- Ghi nguyên tử: Entries → LiabilityEntries → Transactions (Transactions ghi sau cùng; thiếu header = giao dịch chưa hoàn tất, bị bộ kiểm tra toàn vẹn báo).
- Chuỗi băm SHA-256 + quét hằng ngày + nhật ký sửa tay: **phát hiện** sửa tay, không chặn được (đã chấp nhận). [ĐÃ DUYỆT]

## Công thức
- Số dư ví = số dư đầu + Σ Entries (từ ngày bắt đầu của ví trở đi). Giao dịch ngày trước ngày bắt đầu là lịch sử, không đổi số dư.
- Thu nhập = Σ thu (income) + bán tài sản (asset_sale) − thu bị đảo.
- Chi tiêu = Σ chi (expense) − hoàn tiền (refund) − chi bị đảo.
- Dòng tiền ròng = Thu nhập − Chi tiêu.
- **Không** tính vào thu/chi: chuyển ví, điều chỉnh số dư, trả nợ vay, điều chỉnh dư nợ, mua tài sản, chuyển ngân sách. [ĐÃ DUYỆT]
- Tài sản ròng = tiền khả dụng (ví tiền mặt + ngân hàng) + tiết kiệm + tài sản đang giữ − dư nợ. **Tiền giữ hộ không tính** (hiển thị riêng). [ĐÃ DUYỆT]
- Ngân sách còn lại của lọ = ngân sách gốc + nhận chuyển − chuyển đi − chi tiêu ròng của lọ.

## Giao dịch
- Chuyển ví: hai dòng đối ứng, tổng không đổi, không tính thu/chi, ví nguồn ≠ ví đích. [ĐÃ DUYỆT]
- Điều chỉnh số dư: người dùng nhập số dư thực tế; hệ thống ghi chênh lệch, lý do bắt buộc, lưu số dư trước/sau; không tính thu/chi (hiển thị riêng). Không cho điều chỉnh trước ngày bắt đầu của ví. [ĐÃ DUYỆT]
- Chi tiêu bắt buộc có lọ (suy ra từ danh mục) và người chi; người hưởng mặc định Cả gia đình. [GIẢ ĐỊNH]
- Hoàn tiền: cộng ví, **giảm chi tiêu của lọ** đã chọn. [GIẢ ĐỊNH]
- Trả nợ vay: trừ ví, giảm dư nợ (gốc+lãi gộp), không tính chi tiêu, không được vượt dư nợ. [GIẢ ĐỊNH]
- Mua tài sản: trừ ví, không tính chi tiêu. Bán tài sản: cộng ví, tính thu nhập; tài sản đã bán ra khỏi tài sản ròng. [GIẢ ĐỊNH]
- Tiết kiệm = ví loại `savings`; chuyển vào/ra là chuyển ví. [ĐÃ DUYỆT]
- Ví chỉ đóng được khi số dư = 0. Ví giữ hộ cần tên người gửi.

## Nợ cá nhân (vay mượn người quen, khác "Khoản vay" ngân hàng) — quyết định 06/11/2026
- Theo dõi **cả 2 chiều**: cho vay (`lend`, người khác nợ gia đình) và vay nợ (`borrow`, gia đình nợ người khác). [ĐÃ DUYỆT]
- **Không tính lãi suất** — chỉ theo dõi gốc và đã trả/thu bao nhiêu, còn lại bao nhiêu. [ĐÃ DUYỆT]
- Tạo khoản nợ mới (`debt_lend`/`debt_borrow`) là MỘT bước vừa ghi nhận khoản nợ vừa di chuyển tiền ví ngay: cho vay → trừ ví; vay nợ → cộng ví. Không tính vào thu/chi. [ĐÃ DUYỆT]
- Thu nợ (`debt_collect`, chỉ áp dụng khoản `lend`) → cộng ví, giảm số dư còn được nợ; không tính thu nhập. Trả nợ cá nhân (`debt_repay`, chỉ áp dụng khoản `borrow`) → trừ ví, giảm số dư còn nợ; không tính chi tiêu. Không được thu/trả vượt số dư hiện tại. [ĐÃ DUYỆT]
- Điều chỉnh nợ cá nhân (`debt_adjustment`): giống điều chỉnh dư nợ ngân hàng, lý do bắt buộc, lưu số dư trước/sau. [GIẢ ĐỊNH, theo mẫu Khoản vay hiện có]
- **Tài sản ròng**: khoản cho vay còn lại cộng vào tài sản ròng (giống một khoản phải thu); khoản vay nợ còn lại trừ vào tài sản ròng (gộp chung với dư nợ ngân hàng trong mục "Nợ"). [GIẢ ĐỊNH — mặc định kế toán thông thường, chưa hỏi riêng người dùng, có thể điều chỉnh nếu không đúng ý]
- Dữ liệu lịch sử: 43 dòng "Chi &gt; Cho vay" (1,75tr) và 22 dòng "Thu &gt; Mượn tiền" (16,74tr) trong Excel cũ, trước đây bị bỏ qua lúc nhập liệu, sẽ được đưa vào thành các khoản nợ cá nhân (theo quyết định 06/11/2026). Chưa rõ khoản nào đã trả hết — sẽ đánh dấu rõ để người dùng tự rà soát, không tự ý coi là đã tất toán. [ĐÃ DUYỆT hướng làm, CHƯA THỰC HIỆN]

## Ngân sách
- Theo tháng, số tiền cố định theo lọ; tháng mới sao chép từ tháng gần nhất trước đó. [ĐÃ DUYỆT]
- Chỉ sửa được tháng hiện tại và tương lai; tháng đã qua giữ nguyên. Mọi thay đổi có nhật ký.
- Chuyển ngân sách giữa lọ cần lý do và đủ ngân sách ở lọ nguồn.
- Cảnh báo "gần hết" khi dùng ≥ 80% (đổi được trong Cài đặt); "vượt" khi chi > ngân sách. Vượt vẫn cho ghi giao dịch. [GIẢ ĐỊNH]

## Nhắc nhở & thông báo
- Chỉ email (+ cảnh báo trong app). Nhắc hóa đơn/khoản vay hằng tháng (ngày 1–28, nhắc trước 0–14 ngày), nhắc quá hạn nếu chưa trả trong tháng, ngân sách vượt/gần hết, nhắc nhập liệu sau N ngày không có giao dịch (mặc định 3). Không gửi trùng; lỗi thì thử lại tối đa 3 lần; tối đa 80 email/ngày. [GIẢ ĐỊNH về N=3]

## Sao lưu
- Tuần: bản sao Google Sheet trong Drive, kiểm tra số dòng và mã băm cuối, giữ 8 bản. Tháng: xuất Excel, kiểm tra tệp, giữ 24 bản. Đồng bộ về máy bằng Google Drive for desktop. Không mã hóa. [ĐÃ DUYỆT]
