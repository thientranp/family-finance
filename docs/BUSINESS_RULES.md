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
- Dữ liệu lịch sử "Chi &gt; Cho vay" (43 dòng, 1,75tr) và "Thu &gt; Mượn tiền" (22 dòng, 16,74tr): quyết định 06/11/2026 (đưa vào thành khoản nợ cá nhân) đã bị **GHI ĐÈ** bởi quyết định 07/11/2026 bên dưới sau khi rà lại dữ liệu gốc. [THAY THẾ]

## Nhập dữ liệu lịch sử — các nhóm còn mơ hồ (quyết định 07/11/2026)

Bổ sung/ghi đè một phần quyết định 06/11/2026 trong `DATA_MIGRATION.md`, sau khi mở lại từng dòng gốc trong `Appsheet_Finance.xlsx` để xem bản chất thật (không chỉ dựa vào tên mục và tổng tiền).

- **Cho vay / Mượn tiền** (43 + 22 dòng): rà lại thì **85% số dòng (58/65) không hề ghi số tiền** (0đ, chỉ có tên người) — là một danh sách nhắc tên, không phải giao dịch có số liệu đáng tin. → **Bỏ qua (skip) toàn bộ**, không đưa vào Sổ nợ. Nếu còn khoản nợ thật đang mở, người dùng tự ghi lại thủ công qua tính năng Sổ nợ với số tiền chính xác. [ĐÃ DUYỆT 07/11/2026 — GHI ĐÈ quyết định 06/11/2026]
- **CT tower** (2 dòng, 1.040.700.000đ = 1,04 tỷ tiền nhà + 700.000đ phí ra sổ hồng): là tiền mua nhà. → Ghi vào **Tài sản** (loại Nhà), không tính thu/chi. [ĐÃ DUYỆT 07/11/2026]
- **Điều chỉnh** (Chi 33 dòng 86,16tr + Thu 5 dòng 79,86tr, toàn bộ ghi chú "Mất đâu không biết", cùng ngày 31/12/2022): là đợt đối soát số dư một lần khi bắt đầu dùng hệ thống cũ. **Không dùng được nghiệp vụ "đối soát số dư ví" (`adjustment`) của hệ thống mới** — nghiệp vụ này chặn mọi ngày trước ngày bắt đầu của ví (01/11/2026), mà toàn bộ dữ liệu lịch sử đều trước ngày đó. → Nhập như **chi tiêu/thu nhập lịch sử bình thường**, dưới 2 danh mục mới "Đối soát cũ (lịch sử) - thiếu hụt" (Chi) / "Đối soát cũ (lịch sử) - phát sinh" (Thu), lý do gốc giữ trong ghi chú. [ĐÃ DUYỆT 07/11/2026, SỬA LẠI cách làm so với bản nháp ban đầu sau khi phát hiện xung đột kỹ thuật]
- **Tiết kiệm** (Chi 8 dòng 123,89tr + Thu 14 dòng 707,53tr, toàn bộ qua ví của Cục Cá): tiền gửi/rút sổ tiết kiệm thật. → Tạo ví mới loại `savings` ("Tiết kiệm - Cục Cá"), nhập các dòng này thành **chuyển ví**, không tính thu/chi (đúng quy tắc Tiết kiệm đã duyệt ở trên). [ĐÃ DUYỆT 07/11/2026]
- **Chứng khoán** (Chi 27 dòng 448,04tr qua 3 sàn SSI/pinetree/Entrade + Thu 9 dòng 298,52tr toàn bộ qua pinetree): tiền nạp/rút tài khoản chứng khoán, xử lý giống Tiết kiệm. → Tạo 3 ví mới loại `savings`: "SSI - Chứng khoán", "Pinetree - Chứng khoán", "Entrade - Chứng khoán"; nhập thành **chuyển ví**. 2 dòng Chi không ghi rõ sàn sẽ tạm gộp vào SSI (số dòng nhiều nhất) — có thể sửa lại sau nếu sai. [ĐÃ DUYỆT 07/11/2026]
- **Trả góp** (9 dòng, 18,82tr, toàn bộ ví BIDV - Cục Thịt, 01/2023–09/2023, giảm dần đều mỗi tháng rồi dừng hẳn): một khoản vay tiêu dùng khác (không phải mua nhà/xe), **đã trả xong** tháng 09/2023. Vì không rõ số vay gốc ban đầu nên **không** tạo khoản vay (Liability) riêng — ghi thẳng 9 dòng này là **chi tiêu** thuộc danh mục mới "Trả nợ vay cũ (đã tất toán)" để giữ đúng dòng tiền lịch sử. [ĐÃ DUYỆT 07/11/2026]
- **Ô tô** (10 dòng trong `finance`, 216,69tr, mua xe "Cx3" 22/01/2025) + **file riêng `oto.xlsx`** (do người dùng cung cấp 07/11/2026, có lịch trả góp đầy đủ mà `finance` chỉ ghi 4/23 kỳ đầu): tách 3 phần —
  1. **Mua xe**: giá xe 600.000.000đ, trả trước 190.000.000đ (22/01/2025, dòng có trong `finance`) → **mua tài sản**, Tài sản "Xe Cx3" (loại Xe) ghi nhận **giá trị 600.000.000đ** (không phải 190tr — 190tr chỉ là phần trả trước bằng tiền mặt/chuyển khoản, phần còn lại là vay).
  2. **Vay mua xe**: vay gốc = 600.000.000 − 190.000.000 = **410.000.000đ**, ngày vay 22/01/2025 → tạo **Khoản vay** mới "Vay mua xe Cx3" (original_amount = opening_balance = 410.000.000đ).
  3. **Trả góp**: 23 kỳ theo `oto.xlsx` (28/01/2025 → 25/10/2026, tổng đã trả 138.752.623đ, dư nợ còn lại 271.247.377đ tính đến kỳ cuối) → nhập là **trả nợ vay** (`loan_payment`) cho Khoản vay "Vay mua xe Cx3". 4 kỳ đầu (01–04/2025) lấy đúng ví đã ghi trong `finance`; **19 kỳ sau (05/2025–10/2026) không có trong `finance`, trước đây chưa từng được ghi sổ** — theo xác nhận của người dùng, tất cả trừ từ ví **Vietinbank - Cục Thịt**.
  4. 5 dòng lặt vặt còn lại trong `finance` (vá lốp, bơm điện, gối dựa, bảng số điện thoại, rửa xe, tổng ~1.087.926đ): **chi tiêu** thường, danh mục "Xe và di chuyển". [ĐÃ DUYỆT 07/11/2026]
- **Chi phí** (40 dòng, 3,74tr) + **Phí thẻ** (5 dòng, 335.293đ): là một rổ tạp, tách theo nội dung ghi chú từng dòng —
  - Phí ngân hàng/thẻ (phí thường niên, phí rút tiền, phí chuyển đổi, phí hoàn tiền, phí thẻ, và các dòng không ghi chú nhưng số tiền nhỏ lặp lại đúng mẫu phí định kỳ — 11.000/14.520/66.000đ trên cùng ví) → danh mục mới **"Phí ngân hàng & thẻ"**.
  - Phí hành chính/giấy tờ (chụp ảnh thẻ, hộ chiếu, công chứng, khai sinh, sổ đỏ) → danh mục mới **"Phí hành chính - giấy tờ"**.
  - Phí liên quan xe (cầu đường, vetc, sửa xe thuê) → gộp vào danh mục **"Xe và di chuyển"** có sẵn.
  - 2 dòng tự ghi chú "điều chỉnh" (363.000đ + 95.000đ) → **không dùng `adjustment`** (chặn ngày trước opening_date của ví, xem mục trên) — nhập như chi tiêu lịch sử bình thường vào danh mục mới "Đối soát cũ (lịch sử) - thiếu hụt", cùng cách xử lý với nhóm "Điều chỉnh" chính.
  - 6 dòng còn lại, bản chất không rõ ràng — đã hỏi trực tiếp người dùng và được xác nhận (07/11/2026): **bỏ qua (skip)**, không đưa vào hệ thống. Gồm: 1 dòng mua vàng (34.000đ, "Bỏ vô tiền vàng cho đủ 2.5 củ"), 4 dòng ghi chú "Card Đt" (126.000đ, xác nhận là nạp tiền điện thoại — không liên quan phí ngân hàng), 1 dòng "Anh Thiện Típ" (8.000đ, tiền tặng cá nhân). [ĐÃ DUYỆT 07/11/2026]
- **Thuê xe** (3 dòng, 4,68tr): chi tiêu thường, danh mục "Xe và di chuyển". [ĐÃ DUYỆT 07/11/2026]
- **Vending**: Chi 1 dòng (20tr, "máy bán nước") = mua máy → **mua tài sản**, Tài sản "Máy bán nước tự động" (loại Khác). Thu 11 dòng (20,52tr, tiền xu/doanh thu hằng tháng) = thu nhập vận hành → danh mục thu nhập mới "Thu nhập Vending" (giữ nguyên như quyết định 06/11/2026, không đổi). [ĐÃ DUYỆT 07/11/2026]

## Vàng — quyết định 07/11/2026
- Sổ vàng riêng (`GoldLots`), nhiều lô mua/bán độc lập — không dùng chung với `Assets` nữa (loại "Vàng" của Assets vẫn tồn tại trong code nhưng không dùng). [ĐÃ DUYỆT]
- Mua/bán vàng **có liên kết Ví**, giống hệt mô hình Tài sản: mua trừ ví nhưng không tính chi tiêu; bán cộng ví và tính thu nhập; một lô chỉ bán được 1 lần (bán nguyên lô, không bán lẻ theo chỉ). [ĐÃ DUYỆT]
- Lô vàng được tặng/nhận (vd từ đám cưới)/không rõ giá: tạo với giá mua = 0đ, ghi chú nguồn gốc, **không cần giao dịch ví nào** (hệ thống không cho giao dịch 0đ). [ĐÃ DUYỆT]
- Vàng đang giữ (lô active, chưa bán) cộng vào **Tài sản ròng** theo giá mua đã nhập, cùng triết lý "không tự định giá lại" đã áp dụng cho Tài sản. [GIẢ ĐỊNH — theo đúng quy tắc đã duyệt cho Assets, có thể điều chỉnh nếu không đúng ý]
- Xoá lô: chỉ xoá được khi lô chưa có giao dịch mua/bán nào; có giao dịch rồi thì chỉ ẩn — giống Tài sản. [ĐÃ DUYỆT]
- Dữ liệu lịch sử (sheet `gold`, 9 lô, chưa từng nhập ở bất kỳ import nào trước đây — xem `DATA_MIGRATION.md`): 5 lô không rõ giá mua (0đ, ghi chú nguồn gốc) + 4 lô có giá rõ (tổng 60.415.000đ, mua năm 2024). Người dùng xác nhận 07/11/2026: 4 khoản này **chưa từng được ghi vào sổ giao dịch chính**, nên tạo thêm 1 giao dịch "Mua vàng" cho mỗi lô, trừ từ ví **Vietinbank - Cục Thịt**. [ĐÃ DUYỆT 07/11/2026]

## Sổ cưới — quyết định 07/11/2026
- **Sổ lưu trữ thuần**: không tạo giao dịch thu nhập, không ảnh hưởng ví/dòng tiền gia đình dưới bất kỳ hình thức nào — kể cả khi nhập 487 dòng lịch sử. [ĐÃ DUYỆT]
- Mỗi dòng có thể vừa có Tiền mừng (đồng) vừa có Vàng (chỉ) vừa có USD cùng lúc (hiếm, 3/487 dòng nguồn). Dòng chỉ ghi tên khách mà không rõ số tiền mừng (95/487 dòng nguồn) vẫn được lưu — không bỏ dữ liệu lịch sử. [ĐÃ DUYỆT]
- Cột "Đã trả" trong sổ gốc → trường `repaid`: nghĩa là **đã trả lễ lại (đáp lễ)** cho khách đó ở dịp khác, không liên quan đến việc đã nhận tiền mừng hay chưa. [ĐÃ DUYỆT, theo xác nhận của người dùng]
- Sửa/xoá tự do, không qua cơ chế "chỉ ẩn khi đã có giao dịch" của Tài sản/Vàng — vì sổ cưới không có giao dịch sổ cái nào gắn với nó để mà khoá. [ĐÃ DUYỆT]
- Dữ liệu lịch sử (sheet `wedding`, 487 dòng, 2 đám cưới 30/12/2022 và 11/02/2023, chưa từng nhập ở bất kỳ import nào trước đây): nhập toàn bộ, tổng 213.279.111đ + 12,2 chỉ vàng + 300 USD, không tạo giao dịch nào đi kèm. [ĐÃ DUYỆT 07/11/2026]

## Sự kiện — quyết định 07/11/2026
- Mục đích: khi đi du lịch, về quê, hoặc theo dõi một khoản chi lặp lại gắn với một chủ đề cụ thể (vd chi phí vận hành xe), biết được **tổng đã chi trong kỳ đó** mà vẫn phân loại theo đúng lọ ngân sách như bình thường (sự kiện là một **lớp gắn thẻ thêm**, không thay thế lọ/danh mục). [ĐÃ DUYỆT]
- Chỉ gắn với giao dịch **Chi tiêu**; không áp dụng Thu nhập/Chuyển ví/Mua tài sản/Mua vàng/... [ĐÃ DUYỆT]
- Một giao dịch chỉ gắn **đúng 1** sự kiện. [ĐÃ DUYỆT]
- Ngày bắt đầu/kết thúc chỉ để hiển thị/tham khảo, **không bắt buộc** giao dịch phải nằm trong khoảng đó (vd mua sắm chuẩn bị trước chuyến đi, hoặc sự kiện theo dõi liên tục không có ngày kết thúc). [ĐÃ DUYỆT]
- Sự kiện có thể **chung cả nhà** hoặc **riêng** của một thành viên (giống Ví). [ĐÃ DUYỆT]
- **Ngân sách dự kiến**: một số tổng duy nhất cho cả sự kiện (không chia theo lọ), không bắt buộc. Trang chi tiết sự kiện hiển thị đã chi / còn lại / vượt — đây là một **lớp theo dõi bổ sung**, hoàn toàn độc lập với ngân sách theo lọ hằng tháng (một khoản chi vẫn tính vào ngân sách lọ của nó như bình thường, đồng thời tính luôn vào ngân sách sự kiện nếu được gắn). [ĐÃ DUYỆT]
- **Trạng thái**: `ongoing` (đang diễn ra) | `ended` (đã kết thúc — khoá cứng, không gắn thêm giao dịch mới nào nữa dù gắn tay hay tự động; không mở lại được). [ĐÃ DUYỆT]
- **"Bật tự gắn"**: theo từng thành viên (không phải trạng thái chung toàn hệ thống) — người nào bật thì chỉ giao dịch Chi tiêu do chính người đó tạo mới tự điền sẵn sự kiện đó; bật sự kiện mới tự tắt sự kiện cũ *của chính người đó*, không ảnh hưởng người khác. Tại một giao dịch cụ thể, người dùng vẫn **chọn tay được** sự kiện khác hoặc bỏ gắn để ghi đè — dùng cho trường hợp 2 sự kiện trùng ngày (ví dụ vừa về quê Tết vừa trùng sinh nhật con): bật 1 sự kiện làm mặc định, giao dịch thuộc sự kiện còn lại thì chọn tay. Kết thúc một sự kiện sẽ tự tắt cho bất kỳ ai đang bật nó. [ĐÃ DUYỆT]
- Xoá: chỉ xoá được khi sự kiện chưa có giao dịch nào gắn vào; có rồi thì chỉ ẩn — giống Tài sản/Vàng. [ĐÃ DUYỆT]
- Vàng đang giữ/Tài sản ròng: sự kiện **không** ảnh hưởng tính toán tài sản ròng (khác với Vàng/Tài sản) — chỉ là một chiều báo cáo cho dòng tiền chi tiêu.
- Dữ liệu lịch sử (sheet `event`, 9 sự kiện gốc, cột "Sự kiện" trong sheet `finance` đã gắn sẵn cho toàn bộ 4.504 dòng):
  - `Sinh hoạt` (gắn 4.320/4.504 dòng, 96%) là mã mặc định "không có dịp cụ thể" trong hệ thống cũ — **không tạo sự kiện**, các dòng này giữ nguyên không gắn sự kiện nào trong hệ thống mới. [ĐÃ DUYỆT 07/11/2026]
  - `Mua xe` (5 dòng) trước đây dùng để quản lý khoản vay + mua xe; nay đã có `Liabilities`/`Assets` lo riêng → **bỏ qua theo yêu cầu người dùng**, không tạo sự kiện, 5 dòng chi tiêu cũ giữ nguyên không gắn sự kiện nào. [ĐÃ DUYỆT 07/11/2026]
  - 6 sự kiện còn lại được nhập: "Về quê Quảng Trị (2024)", "Du lịch Vũng Tàu (5/2023)", "Du lịch Vũng Tàu (6/2024)", "Du lịch Phan Thiết (11/2023)", "Du lịch Phan Thiết (3/2025)" — cả 5 ở trạng thái `ended` (đã xong); và **"Cx-3 — chi phí vận hành xe"** được hiểu lại thành theo dõi liên tục chi phí xe (xăng, bảo trì, đăng kiểm, bảo hiểm...), trạng thái `ongoing`, không đặt ngày kết thúc — bật "tự gắn" khi cần ghi thêm chi phí xe mới về sau. [ĐÃ DUYỆT 07/11/2026, theo xác nhận trực tiếp của người dùng về ý nghĩa của "Cx-3"]
  - Chỉ 174 dòng kiểu **Chi** được gắn; 5 dòng **Thu** dưới sự kiện "Về quê" không được gắn (đúng quy tắc: sự kiện chỉ áp dụng Chi tiêu). [ĐÃ DUYỆT]
  - Kỹ thuật: gắn `event_id` bổ sung vào các giao dịch Chi tiêu **đã nhập từ trước** (khớp theo `idempotency_key`) — đã xác minh cột `event_id` không nằm trong công thức băm `row_hash`, nên thao tác này an toàn tuyệt đối với chuỗi chống sửa của sổ cái.

## Ngân sách
- Theo tháng, số tiền cố định theo lọ; tháng mới sao chép từ tháng gần nhất trước đó. [ĐÃ DUYỆT]
- Chỉ sửa được tháng hiện tại và tương lai; tháng đã qua giữ nguyên. Mọi thay đổi có nhật ký.
- Chuyển ngân sách giữa lọ cần lý do và đủ ngân sách ở lọ nguồn.
- Cảnh báo "gần hết" khi dùng ≥ 80% (đổi được trong Cài đặt); "vượt" khi chi > ngân sách. Vượt vẫn cho ghi giao dịch. [GIẢ ĐỊNH]

## Nhắc nhở & thông báo
- Chỉ email (+ cảnh báo trong app). Nhắc hóa đơn/khoản vay hằng tháng (ngày 1–28, nhắc trước 0–14 ngày), nhắc quá hạn nếu chưa trả trong tháng, ngân sách vượt/gần hết, nhắc nhập liệu sau N ngày không có giao dịch (mặc định 3). Không gửi trùng; lỗi thì thử lại tối đa 3 lần; tối đa 80 email/ngày. [GIẢ ĐỊNH về N=3]

## Sao lưu
- Tuần: bản sao Google Sheet trong Drive, kiểm tra số dòng và mã băm cuối, giữ 8 bản. Tháng: xuất Excel, kiểm tra tệp, giữ 24 bản. Đồng bộ về máy bằng Google Drive for desktop. Không mã hóa. [ĐÃ DUYỆT]
