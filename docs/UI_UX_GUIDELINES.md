# UI/UX Guidelines — Family Finance (bản Supabase/Next.js)

- **Trạng thái:** DỰ THẢO — chờ bạn duyệt trước khi code UI ở Giai đoạn 7 (`MIGRATION_PLAN.md`).
- **Mục đích:** đặc tả đủ chi tiết để một AI coding assistant (Claude Code, Cursor...) implement đúng, nhất quán, không cần đoán hay tự quyết thêm.
- **Quyết định đã chốt (07/11/2026):** phong cách "làm mới hoàn toàn, hiện đại kiểu fintech chuyên nghiệp"; bảng màu do Claude đề xuất (xem mục 2); điều hướng chính trên điện thoại là **menu kéo (drawer)**, không dùng thanh tab dưới; **chỉ làm 1 giao diện sáng**, không cần dark mode.
- **Không đổi so với bản Apps Script:** toàn bộ nghiệp vụ, tên trường, luồng nhập liệu — tài liệu này chỉ quy định phần **nhìn và cảm nhận (look & feel)**, không định nghĩa lại business logic (xem `BUSINESS_RULES.md`).

---

## 1. Định hướng thiết kế (design brief tự xác lập)

**Chủ thể:** sổ sách tài chính riêng của một gia đình nhỏ (2 người: Cục Thịt, Cục Cá), không phải SaaS đa người dùng, không phải app ngân hàng thương mại. Nhưng người dùng chủ động chọn cảm giác "fintech chuyên nghiệp" — sắc nét, nhiều số liệu, bố cục chặt — thay vì cảm giác "sổ tay gia đình" ấm áp.

**Góc nhìn thiết kế riêng cho dự án này (để không trôi về mặc định AI-tạo):**
- Gia đình đang theo dõi **vàng** như một loại tài sản thật (sheet `GoldLots`) — vàng gắn với sự thịnh vượng, tích luỹ trong văn hoá Việt. Dùng làm cảm hứng cho màu nhấn (ánh kim/đồng thay vì xanh dương ngân hàng rập khuôn).
- Hệ thống có khái niệm **sổ cái bất biến** (ledger không sửa/xoá, chỉ thêm) — đây là một ẩn dụ thị giác tốt: danh sách giao dịch nên trông như *dòng sổ cái* (gạch chia mảnh, có thứ tự thời gian rõ), không phải *thẻ SaaS* rời rạc.
- Hai tên riêng "Cục Thịt"/"Cục Cá" là biệt danh thân mật — giữ đúng tên, không trang trọng hoá, nhưng không cần thể hiện "dễ thương" qua màu sắc; sự thân mật nằm ở ngôn ngữ (mục 7), không nằm ở bảng màu.

**Việc KHÔNG làm (các dấu hiệu "AI tạo" mặc định, tránh tuyệt đối):**
- Nền kem (#F4F1EA) + chữ serif lớn + màu nhấn cam đất (#D97757).
- Nền gần đen (#0B0B0B/#111) + 1 màu neon (xanh chanh/đỏ rực).
- Toàn bộ nội dung chia thành thẻ bo góc giống nhau, cùng 1 độ bo, cùng 1 shadow mờ `rgba(0,0,0,.1)` dưới mọi thẻ.
- Nhãn ALL CAPS có letter-spacing phía trên heading; chuỗi mô tả nối bằng dấu `·`; nhãn kiểu "TỪ — mô tả"; mũi tên `→` gắn sau nút/link; chữ số liệu nhỏ dùng monospace chỉ để "trông kỹ thuật".
- Số thứ tự 01/02/03 trang trí khi nội dung không thực sự là một chuỗi bước.

---

## 2. Design tokens

### 2.1. Màu sắc

Bảng màu "Ink & Gold" — nền tối giản trung tính lạnh (giữ cảm giác chuyên nghiệp/dữ liệu), 1 màu nhấn ánh kim gắn với chủ đề vàng/thịnh vượng, màu ngữ nghĩa (thu/chi) tách biệt hẳn khỏi màu nhấn trang trí để không gây nhầm lẫn khi đọc số liệu.

| Token | Hex | Dùng cho |
|---|---|---|
| `--ink-900` | `#101826` | Chữ chính, nền sidebar/topbar desktop |
| `--ink-700` | `#2B3444` | Chữ phụ đậm, icon chính |
| `--ink-500` | `#5B6578` | Chữ phụ, placeholder, label |
| `--surface-0` | `#F6F7FA` | Nền trang (body) |
| `--surface-1` | `#FFFFFF` | Nền card/section nổi khối |
| `--line` | `#E4E7ED` | Viền, gạch chia dòng sổ cái |
| `--gold-600` | `#B8872E` | Màu nhấn chính: nút chính, trạng thái đang chọn, biểu đồ chuỗi 1, icon active |
| `--gold-100` | `#F6EBD4` | Nền nhạt cho badge/chip liên quan tới màu nhấn |
| `--teal-700` | `#0E7C66` | **Chỉ dùng cho số dương/thu nhập/tăng** — không dùng trang trí |
| `--teal-100` | `#DCF0EA` | Nền badge "thu nhập"/"tăng" |
| `--brick-700` | `#AA4430` | **Chỉ dùng cho số âm/chi tiêu/giảm/vượt ngân sách** — không dùng trang trí |
| `--brick-100` | `#F6E2DC` | Nền badge "chi tiêu"/"vượt ngân sách" |
| `--danger-700` | `#C23B3B` | Lỗi, hành động phá hủy (xoá) — tách riêng khỏi `--brick-700` dù gần giống, để không lẫn "chi tiêu" với "lỗi hệ thống" |

Quy tắc dùng màu:
- `--gold-600` là màu nhấn **duy nhất** cho hành động/điều hướng (nút chính, tab đang chọn, link). Không dùng teal/brick cho mục đích trang trí — hai màu này **chỉ** mang nghĩa tăng/giảm tài chính, để người dùng nhìn màu là hiểu ngay dấu của số tiền.
- Không dùng gradient. Không dùng shadow màu (chỉ shadow xám trung tính rất nhẹ, xem 2.4).
- Biểu đồ (Recharts): chuỗi dữ liệu dùng thang từ `--gold-600` → các sắc độ ink/gold trung tính; **không** dùng teal/brick cho biểu đồ phân loại chi tiêu (chỉ dùng cho đúng ngữ cảnh tăng/giảm số tiền, ví dụ biểu đồ dòng tiền thu/chi theo tháng mới dùng teal/brick).

### 2.2. Typography

Hai font, vai trò rõ ràng — không dùng font mặc định kiểu Inter-cho-tất-cả:

| Vai trò | Font | Nguồn |
|---|---|---|
| UI chung: heading, nhãn, nút, nội dung | **Manrope** (400/500/600/700/800) | Google Fonts, qua `next/font/google` |
| **Số tiền và mọi cột số liệu** (bảng giao dịch, số dư, KPI) | **JetBrains Mono** (400/500/700), `font-feature-settings: "tnum"` | Google Fonts |

Lý do dùng monospace cho số tiền: đây là **lựa chọn chức năng, không trang trí** — cột số liệu thẳng hàng giúp quét nhanh số lớn/nhỏ, đúng tinh thần "dữ liệu dày đặc" đã chọn ở phong cách fintech.

Type scale (rem, dòng cao tương ứng):

| Cấp | Size/Line-height | Font/weight | Dùng cho |
|---|---|---|---|
| `display` | 2.25rem / 2.6rem | Manrope 800 | Số tài sản ròng ở Tổng quan (duy nhất dùng cấp này) |
| `h1` | 1.5rem / 1.9rem | Manrope 700 | Tiêu đề màn hình |
| `h2` | 1.125rem / 1.5rem | Manrope 700 | Tiêu đề section trong màn hình |
| `body` | 0.9375rem / 1.4rem | Manrope 500 | Nội dung chung |
| `label` | 0.8125rem / 1.1rem | Manrope 600 | Nhãn trường, nhãn nhỏ (viết hoa chữ đầu câu, **không ALL CAPS**) |
| `amount-lg` | 1.375rem / 1.6rem | JetBrains Mono 700 | Số dư ví, số tiền trong form nhập |
| `amount-md` | 0.9375rem / 1.3rem | JetBrains Mono 500 | Số tiền trong danh sách giao dịch |
| `amount-sm` | 0.8125rem / 1.1rem | JetBrains Mono 500 | Số tiền phụ (KPI nhỏ) |

Độ dài dòng: nội dung mô tả/ghi chú tối đa ~70 ký tự/dòng trên desktop (cột nội dung không kéo full-width quá 640px).

### 2.3. Spacing & radius

- Thang spacing: `4, 8, 12, 16, 24, 32, 48` px — không dùng số lẻ ngoài thang này.
- Radius: **2 cấp duy nhất**, dùng có chủ đích:
  - `radius-sm` = 8px: input, button, badge, chip.
  - `radius-md` = 14px: khối hero (số tài sản ròng, card tổng quan ví) — **không** dùng cho dòng danh sách giao dịch (xem 2.4, dòng sổ cái không bo góc).
- Không có `radius-full`/bo tròn toàn phần trừ avatar và chip trạng thái nhỏ.

### 2.4. Hai kiểu "khối nội dung" — chủ đích tránh "SaaS card kit"

1. **Khối nổi (elevated block)** — dùng **rất hạn chế**, chỉ cho 1-2 số liệu quan trọng nhất mỗi màn hình (số tài sản ròng ở Tổng quan, số dư ví đang chọn ở màn Ví): nền `--surface-1`, `radius-md`, shadow rất nhẹ `0 1px 2px rgba(16,24,38,.06)`, viền `1px solid var(--line)`.
2. **Dòng sổ cái (ledger row)** — dùng cho **mọi danh sách** (giao dịch, sự kiện, khoản vay...): không có thẻ riêng, không bo góc, không shadow — mỗi dòng là 1 hàng flex, ngăn cách bằng `border-bottom: 1px solid var(--line)`, padding dọc 12px. Đây là cách chính để liệt kê nội dung trong toàn app — **không** bọc từng giao dịch vào một thẻ bo góc riêng.

### 2.5. Breakpoint

- `mobile`: < 768px (thiết kế gốc, ưu tiên).
- `desktop`: ≥ 1024px. Khoảng 768–1024px dùng lại layout mobile (drawer), chỉ nới container rộng hơn.

---

## 3. Bố cục & điều hướng

### 3.1. Mobile (< 1024px) — menu kéo (drawer)

```
┌─────────────────────────────┐
│ ☰   Tổng quan            👤 │  ← Topbar cố định, cao 56px, nền --surface-1
├─────────────────────────────┤
│                             │
│   (nội dung màn hình)       │
│                             │
│                        [+]  │  ← FAB "Thêm giao dịch", góc dưới-phải,
│                             │     nền --gold-600, luôn hiện mọi màn hình
└─────────────────────────────┘
```

- Bấm `☰` mở drawer trượt từ trái, rộng ~80% màn hình, nền `--ink-900`, chữ trắng/ink-100. Danh sách mục điều hướng xếp dọc, icon + tên, mục đang active có nền `--gold-600` mờ 15% + chữ `--gold-600`.
- Thứ tự mục trong drawer: Tổng quan, Giao dịch, Ví, Ngân sách, Tài sản & Nợ, Sự kiện, Vàng, Sổ cưới, (---) Cài đặt, Đăng xuất.
- `FAB [+]` luôn mở trực tiếp form "Thêm giao dịch" (bottom sheet, xem 4.7) — **không** phải mở drawer trước. Đây là hành động được dùng nhiều nhất (REQ-028), phải tới được trong 1 lần bấm từ bất kỳ màn hình nào.

### 3.2. Desktop (≥ 1024px) — sidebar cố định

```
┌────────────┬────────────────────────────────┐
│            │ Tổng quan                   👤  │ ← Topbar, chỉ còn tiêu đề + avatar
│  Sidebar   ├────────────────────────────────┤
│  (240px)   │                                 │
│  --ink-900 │      (nội dung màn hình,        │
│            │       container max 960px,      │
│  [+ Thêm   │       căn giữa)                 │
│   giao     │                                 │
│   dịch]    │                                 │
│            │                                 │
└────────────┴────────────────────────────────┘
```

- Sidebar luôn hiện, thay cho drawer — cùng nội dung mục điều hướng, cùng màu `--ink-900`.
- Nút "+ Thêm giao dịch" cố định đầu sidebar (không phải FAB nổi trên desktop) — mở modal thay vì bottom sheet.

---

## 4. Thành phần UI

### 4.1. Nút (Button)

| Loại | Nền | Chữ | Dùng cho |
|---|---|---|---|
| Primary | `--gold-600` | trắng | Hành động chính duy nhất/màn hình: Lưu, Xác nhận |
| Secondary | trong suốt, viền `1px solid var(--line)` | `--ink-900` | Hành động phụ: Hủy, Sửa |
| Destructive | trong suốt, viền `--danger-700` | `--danger-700` | Xoá, Kết thúc sự kiện |
| Text | trong suốt, không viền | `--ink-700` | Hành động ít quan trọng trong danh sách (Xem chi tiết) |

Chữ nút là **động từ hành động cụ thể**, không dùng "Submit"/"OK": "Lưu giao dịch", "Kết thúc sự kiện", "Xoá ví". Không gắn `→` sau chữ nút. Toast sau khi bấm phải lặp lại đúng động từ: bấm "Lưu giao dịch" → toast "Đã lưu giao dịch".

### 4.2. Input số tiền

- Căn phải, font `amount-lg`, luôn hiện đơn vị "đ" bên phải, tự chèn dấu phân nghìn khi gõ (format ngay khi nhập, không chờ submit).
- Bàn phím số trên mobile (`inputmode="decimal"` nhưng chặn ký tự thập phân — tiền là số nguyên theo `BUSINESS_RULES.md`).
- Không có spinner tăng/giảm (không phù hợp số tiền lớn).

### 4.3. Dropdown tìm kiếm được (ví/lọ/danh mục/sự kiện)

- Dùng `Combobox` của shadcn — gõ để lọc, không phải `<select>` thường (đúng REQ-UX "searchable dropdowns").
- Mục được chọn gần nhất/thường dùng nhất hiện đầu danh sách khi chưa gõ gì (REQ "nhớ danh mục thường dùng").

### 4.4. Badge trạng thái

- `radius-sm`, padding `4px 10px`, chữ `label`, chữ hoa đầu câu (không ALL CAPS).
- Ví dụ: "Đang diễn ra" (nền `--gold-100`, chữ `--gold-600`), "Đã kết thúc" (nền `--surface-0`, chữ `--ink-500`), "Vượt ngân sách" (nền `--brick-100`, chữ `--brick-700`).

### 4.5. Khối số liệu lớn (hero number)

Dùng đúng 1 lần/màn hình (xem 2.4 khối nổi): nhãn `label` phía trên (không ALL CAPS, không icon thừa), số liệu `display` hoặc `amount-lg`, dòng phụ bên dưới liệt kê chi tiết bằng `body` + `amount-sm`, không dùng dấu `·` để nối — mỗi mục phụ xuống dòng riêng hoặc dùng khoảng trắng + gạch dọc mảnh `|` nếu cùng dòng.

### 4.6. Dòng sổ cái (ledger row) — cho danh sách giao dịch/sự kiện/khoản vay

```
[Icon danh mục]  Tên danh mục / mô tả ngắn        -1.250.000 đ
                 Ví · 12:30 10/11                   
```
- Dòng 1: icon tròn nhỏ (nền nhạt theo nhóm lọ) + mô tả chính (trái) + số tiền `amount-md` màu `--brick-700` (chi) hoặc `--teal-700` (thu) (phải).
- Dòng 2 (phụ, `--ink-500`, size nhỏ hơn): tên ví + giờ/ngày — nối bằng khoảng trắng, không dùng `·` (tránh "tell" đã nêu ở mục 1). Có thể dùng gạch đứng mảnh thay thế nếu cần phân tách rõ, nhưng ưu tiên xuống dòng/khoảng cách.
- Bấm vào dòng mở bottom sheet/side panel chi tiết, không chuyển trang.

### 4.7. Form "Thêm giao dịch" (bottom sheet trên mobile, modal trên desktop)

Thứ tự trường đúng theo REQ-028 + REQ 7.3, đi từ trên xuống, số tiền luôn trên cùng vì là trường quan trọng nhất và gõ đầu tiên:
1. Số tiền (to, rõ, auto-focus khi mở form).
2. Loại giao dịch (segmented control ngang: Thu / Chi / Chuyển / Điều chỉnh — không dùng dropdown cho 4 lựa chọn cố định này).
3. Ví (combobox tìm kiếm).
4. Danh mục → lọ tự suy ra, hiện ngay dưới dạng chip phụ không cần chọn tay (trừ khi muốn đổi).
5. Người chi / Người hưởng (chip chọn nhanh 2 thành viên, không cần dropdown).
6. Sự kiện (chỉ hiện khi loại = Chi; mặc định theo `current_event_id` của người đang đăng nhập, có thể đổi tay).
7. Ngày (mặc định hôm nay).
8. Ghi chú (textarea 1 dòng, giãn khi gõ dài).

Nút "Lưu giao dịch" dính đáy sheet/modal, luôn hiện không cần cuộn.

### 4.8. Trạng thái rỗng / lỗi / đang tải

- **Rỗng:** 1 câu ngắn nói đúng việc có thể làm tiếp, kèm nút hành động. Ví dụ màn Sự kiện rỗng: "Chưa có sự kiện nào. Tạo sự kiện khi đi du lịch hoặc có dịp cần theo dõi chi tiêu riêng." + nút "Tạo sự kiện".
- **Lỗi:** nói đúng điều xảy ra và cách sửa, giọng hệ thống (không xưng "tôi xin lỗi"). Ví dụ: "Không lưu được giao dịch — số dư ví sẽ bị âm quá mức cho phép với khoản vay này." (khớp đúng rule chặn `loan_payment` overpay).
- **Đang tải:** skeleton (khối xám nhạt `--surface-0` nhấp nháy nhẹ) đúng hình dạng nội dung sắp hiện — không dùng spinner tròn chung cho cả danh sách dài.

---

## 5. Màn hình cụ thể

### 5.1. Tổng quan (Home)
- 1 khối nổi duy nhất: Tài sản ròng (`display`), 4 dòng phụ (Tiền khả dụng/Tiết kiệm/Tài sản/Nợ) dạng lưới 2x2 bên dưới, không phải liệt kê ngang 1 dòng.
- Dưới đó: 3 KPI tháng hiện tại (Thu/Chi/Chênh lệch) dạng 3 cột ngang, mỗi cột chỉ nhãn + số (`amount-md`), không viền thẻ riêng — phân tách bằng khoảng trắng + 1 đường kẻ dọc mảnh.
- Cảnh báo ngân sách (nếu có): danh sách badge "Vượt ngân sách"/"Gần hết" xếp ngang, cuộn ngang nếu nhiều.
- Danh sách giao dịch gần nhất (8 dòng, kiểu ledger row 4.6) + link "Xem tất cả".
- Sổ nợ cá nhân đang mở (nếu có), cùng kiểu ledger row.

### 5.2. Thêm giao dịch
Xem 4.7. Truy cập qua FAB (mobile) hoặc nút đầu sidebar (desktop) — không nằm trong luồng điều hướng drawer.

### 5.3. Danh sách giao dịch
- Thanh lọc trên cùng: khoảng ngày, loại, ví, lọ, sự kiện — dạng chip bấm mở popover, không phải 1 form lọc dài luôn hiện.
- Danh sách ledger row, nhóm theo ngày (tiêu đề nhóm "10/11/2026" dạng `label`, `--ink-500`, không viền).

### 5.4. Ví
- Danh sách ví dạng ledger row (tên ví, chủ sở hữu phụ, số dư `amount-md` phải).
- Bấm vào 1 ví → khối nổi số dư ví đó + lịch sử giao dịch của riêng ví này.

### 5.5. Ngân sách (6 lọ)
- Mỗi lọ: 1 dòng ngang gồm tên lọ, thanh progress ngang (nền `--surface-0`, phần đã dùng `--gold-600` nếu bình thường, `--brick-700` nếu vượt), số đã dùng/tổng bên phải dạng `amount-sm`.
- Không dùng biểu đồ tròn (donut chart) cho 6 lọ — với 6 giá trị, thanh ngang xếp dọc dễ so sánh hơn donut.

### 5.6. Tài sản & Nợ
- 2 tab con (segmented control): Tài sản | Nợ vay.
- Mỗi khoản là ledger row; khoản vay có thêm badge trạng thái + mini-progress trả nợ (đã trả/tổng).
- Chi tiết khoản vay: lịch sử trả nợ (ledger row) + lịch sử lãi suất (`LiabilityRates`) hiện dạng timeline dọc đơn giản (mốc ngày bên trái, % lãi bên phải), **không** dùng số thứ tự 01/02/03 vì đây đúng là 1 chuỗi theo thời gian — số thứ tự ở đây hợp lý vì nội dung thực sự tuần tự.

### 5.7. Sự kiện
- Danh sách ledger row: tên sự kiện, badge trạng thái (Đang diễn ra/Đã kết thúc), tổng đã chi bên phải.
- Toggle "Tự gắn" cho sự kiện đang hiện (switch, không phải checkbox) — khi bật, hiện rõ ghi chú nhỏ "Giao dịch chi tiêu mới của bạn sẽ tự gắn vào sự kiện này".
- Chi tiết sự kiện: khối nổi nhỏ (đã chi/ngân sách dự kiến nếu có) + danh sách giao dịch thuộc sự kiện.

### 5.8. Vàng & Sổ cưới
- Cùng mẫu ledger row list + form thêm đơn giản, không cần thiết kế riêng biệt — đây là màn hình phụ, giữ nhất quán với phần còn lại hơn là tạo điểm nhấn riêng.

### 5.9. Đăng nhập
- Màn hình tối giản: nền `--ink-900`, logo/tên app giữa màn hình (`h1`, chữ trắng), 1 nút "Đăng nhập với Google" (nền trắng, theo chuẩn nút Google, không tự vẽ lại icon Google).
- Không slogan markéting, không hình minh hoạ trang trí — đây là app gia đình riêng tư, không cần "bán" bản thân với người dùng đã quen.

---

## 6. Biểu đồ (Recharts)

- Biểu đồ dòng tiền theo tháng: line chart 2 đường (Thu = `--teal-700`, Chi = `--brick-700`), không fill vùng dưới đường (tránh hiệu ứng gradient trang trí).
- Biểu đồ chi theo danh mục: horizontal bar chart (không donut) — so sánh độ dài dễ hơn so sánh góc, và khớp với danh sách 6 lọ/nhiều danh mục (nhiều lát donut nhỏ khó đọc).
- Trục, nhãn dùng font Manrope `label`, số liệu trên biểu đồ dùng JetBrains Mono.
- Tối đa 1 hiệu ứng động/màn hình (ví dụ: thanh bar chạy từ 0 lên khi tải xong) — không hover-transition trang trí ở mọi điểm dữ liệu.

---

## 7. Nguyên tắc viết nội dung (copywriting tiếng Việt)

- **Chủ ngữ ẩn, động từ chủ động**: "Lưu giao dịch", "Không xoá được — còn giao dịch gắn với ví này" — không viết "Hệ thống sẽ lưu...", "Rất tiếc, ...".
- **Tên hành động nhất quán xuyên luồng**: nút "Kết thúc sự kiện" → xác nhận "Kết thúc sự kiện này?" → toast "Đã kết thúc sự kiện". Không đổi từ giữa đường (ví dụ không chuyển sang "Đóng sự kiện" ở bước khác).
- **Không ALL CAPS** cho nhãn/badge — dùng chữ hoa đầu câu bình thường.
- **Không nối chuỗi bằng `·`** — dùng khoảng trắng, xuống dòng, hoặc gạch dọc mảnh `|` khi thật cần phân tách cùng dòng.
- **Không thêm `→`** sau nút/link.
- **Trạng thái rỗng = lời mời hành động**, không phải câu thông báo khô: "Chưa có..." + luôn kèm nút để làm ngay, không bỏ trống.
- Giữ đúng tên hiển thị "Cục Thịt"/"Cục Cá" ở mọi nơi hiện tên thành viên — không viết tắt, không đổi thành "A"/"B".

---

## 8. Khả năng tiếp cận & trạng thái

- Mọi phần tử bấm được có focus ring rõ (`outline: 2px solid var(--gold-600)`, offset 2px) — kể cả khi dùng mouse, không chỉ khi dùng Tab.
- Tương phản chữ/nền đạt tối thiểu AA (đã kiểm: `--ink-900` trên `--surface-0`/`--surface-1` đạt AA cho text thường và lớn).
- `prefers-reduced-motion: reduce` → tắt toàn bộ transition/animation (kể cả hiệu ứng progress bar ở 6.1).
- Vùng bấm tối thiểu 44×44px trên mobile (FAB, icon trong topbar, mục drawer).
- Input tiền và trường bắt buộc có thông báo lỗi ngay dưới trường (không chỉ viền đỏ) — chữ lỗi dùng `--danger-700`.

---

## 9. Áp dụng vào Tailwind + shadcn/ui

- `tailwind.config.ts`: khai báo toàn bộ token mục 2 vào `theme.extend.colors` (dùng đúng tên biến, ví dụ `ink.900`, `gold.600`, `teal.700`, `brick.700`) và `theme.extend.fontFamily` (`sans: ['Manrope', ...]`, `mono: ['"JetBrains Mono"', ...]`).
- Nạp font qua `next/font/google` (Manrope + JetBrains Mono), không nạp qua `<link>` thủ công — tối ưu sẵn của Next.js.
- Dùng component gốc của shadcn/ui (`Button`, `Dialog`, `Sheet`, `Command` cho combobox, `Switch`, `Badge`) rồi override màu/radius qua token ở trên — **không** tự viết lại component từ đầu.
- `Sheet` (shadcn) dùng cho bottom sheet mobile (form thêm giao dịch, chi tiết); `Dialog` dùng cho modal desktop — có thể dùng cùng 1 component content, chỉ đổi `side`/kiểu hiển thị theo breakpoint.
- Dòng sổ cái (4.6) viết thành 1 component `LedgerRow` dùng lại ở mọi màn hình danh sách — không viết lại markup mỗi nơi.

---

## 10. Checklist trước khi coi UI hoàn thành (dùng cho từng màn hình ở Giai đoạn 7)

- [ ] Không còn thẻ bo góc + shadow lặp lại cho danh sách — đã dùng `LedgerRow`.
- [ ] Không còn nhãn ALL CAPS, không còn `·` nối chuỗi, không còn `→` sau nút.
- [ ] Số tiền dùng đúng font JetBrains Mono, căn phải, có dấu phân nghìn.
- [ ] Teal/brick chỉ xuất hiện ở số liệu tăng/giảm — không dùng trang trí ở nơi khác.
- [ ] Trạng thái rỗng/lỗi/loading đều có, đúng giọng văn mục 7.
- [ ] Kiểm tra responsive thật ở 375px (iPhone SE) và ở desktop ≥1280px — không chỉ xem ở 1 khổ.
- [ ] Focus ring kiểm tra bằng Tab thật, không chỉ nhìn bằng mắt trong Figma/thiết kế.
