# Hướng dẫn chuẩn bị máy cá nhân để xây hệ thống Supabase + Vercel

Hướng dẫn này viết cho người **không có chuyên môn IT**. Làm theo đúng thứ tự, mỗi bước chỉ vài phút. Nếu có bước không hiểu, dừng lại và hỏi — không cần tự đoán.

**Tin tốt:** phần lớn việc cài phần mềm, bạn KHÔNG cần tự làm. Khi bạn mở app **Claude Desktop** trên laptop và liên kết với máy đó, Claude có thể tự chạy lệnh cài đặt giúp bạn (giống như cách Claude đang đồng bộ file vào `D:\FAMILY_FINANCES` cho bạn ngay trong cuộc trò chuyện này). Phần bạn **chắc chắn phải tự làm bằng tay** là tạo 3 tài khoản ở Mục 2, vì cần email và xác nhận thật của bạn.

---

## 0. Tổng quan — bạn cần làm gì, theo thứ tự

| # | Việc | Ai làm | Thời gian |
|---|---|---|---|
| 1 | Tạo 1 thư mục trống cho dự án mới trên laptop | Bạn (vài giây) | — |
| 2 | Tạo 3 tài khoản: GitHub, Supabase, Vercel | **Bạn tự làm** (cần email xác nhận) | ~15 phút |
| 3 | Cài phần mềm cần thiết (Node.js, Git) | Claude tự làm qua máy bạn, hoặc bạn tự cài theo hướng dẫn | ~10 phút |
| 4 | Copy tài liệu dự án qua thư mục mới | Claude đã chuẩn bị sẵn — bạn chỉ cần copy 1 thư mục | ~1 phút |
| 5 | Mở Claude Desktop, liên kết với thư mục mới, bắt đầu | Bạn + Claude | — |

---

## 1. Tạo thư mục dự án mới

Mở **File Explorer** (biểu tượng thư mục ở thanh taskbar Windows), vào ổ `D:\`, tạo một thư mục mới tên:

```
D:\FAMILY_FINANCE_SUPABASE
```

(Chuột phải vào khoảng trống trong ổ D: → **New** → **Folder** → đặt tên như trên → Enter.)

Đây sẽ là nơi chứa toàn bộ dự án mới — tách biệt hoàn toàn với `D:\FAMILY_FINANCES` (dự án Apps Script cũ, vẫn giữ nguyên, không đụng tới).

---

## 2. Tạo 3 tài khoản (bắt buộc tự làm tay)

Mở trình duyệt (Chrome/Edge), làm theo thứ tự. Gợi ý dùng email `tranphucthiena2tqt@gmail.com` (hoặc email bạn hay dùng cho các tài khoản quan trọng) cho cả 3 tài khoản để dễ quản lý.

### 2.1. GitHub (nơi lưu trữ mã nguồn)

1. Vào **https://github.com/signup**
2. Nhập email, đặt mật khẩu, đặt tên người dùng (username) — tuỳ ý, ví dụ `thientran-family`.
3. Xác minh theo yêu cầu trên màn hình (có thể là giải captcha hoặc nhập mã gửi qua email).
4. Kiểm tra hộp thư, bấm vào link xác nhận email nếu GitHub yêu cầu.
5. Xong — **chưa cần tạo repository nào vội**, Claude sẽ hướng dẫn tạo đúng lúc vào Giai đoạn 0.

⚠️ Khi tạo repository (kho mã nguồn) sau này, luôn chọn **Private** — vì đây là dữ liệu tài chính gia đình, không để ai khác xem được.

### 2.2. Supabase (nơi lưu database)

1. Vào **https://supabase.com**
2. Bấm **"Start your project"**.
3. Chọn **"Continue with GitHub"** — dùng tài khoản GitHub vừa tạo ở bước 2.1, để 2 tài khoản tự liên kết với nhau.
4. Màn hình GitHub hiện ra hỏi "Authorize Supabase" → bấm **Authorize**.
5. Xong — **chưa cần tạo project nào vội** trong Supabase, Claude sẽ hướng dẫn đặt tên + chọn khu vực server + mật khẩu database đúng lúc vào Giai đoạn 0 (vì mật khẩu database cần đặt cẩn thận và lưu lại an toàn).

### 2.3. Vercel (nơi chạy website)

1. Vào **https://vercel.com/signup**
2. Chọn **"Continue with GitHub"**.
3. Authorize khi được hỏi.
4. Xong — chưa cần làm gì thêm.

**Tới đây, Mục 2 đã hoàn tất.** Ba tài khoản đã liên kết sẵn với nhau qua GitHub, sẽ dùng tới khi bắt đầu code thật.

---

## 3. Phần mềm cần cài trên laptop

Đây là 2 phần mềm cần có để chạy được dự án Next.js:

| Phần mềm | Dùng để làm gì |
|---|---|
| **Node.js** (bản LTS) | Chạy được code JavaScript/Next.js trên máy bạn |
| **Git** | Đồng bộ code lên GitHub |

### Cách dễ nhất: để Claude tự cài

Khi bạn mở một cuộc trò chuyện Claude Desktop **mới**, liên kết với máy laptop này (chọn **"Link to this computer"** trong app, hoặc mở task có chọn máy), bạn chỉ cần nói với Claude:

> "Cài giúp tôi Node.js và Git trên máy này."

Claude sẽ tự chạy lệnh cài đặt qua máy bạn (giống cách Claude đang đồng bộ file cho bạn trong cuộc trò chuyện hiện tại), không cần bạn tự bấm cài.

### Nếu muốn tự cài tay

1. **Node.js**: vào **https://nodejs.org**, bấm nút tải bản **LTS** (bản màu xanh, ghi "Recommended for most users"), chạy file `.msi` vừa tải, bấm Next liên tục tới khi xong (giữ nguyên mọi tuỳ chọn mặc định).
2. **Git**: vào **https://git-scm.com/downloads/win**, tải và chạy file cài, cũng bấm Next liên tục với tuỳ chọn mặc định.
3. Sau khi cài xong cả 2, mở **PowerShell** (gõ "PowerShell" vào ô tìm kiếm Windows), gõ `node -v` rồi Enter — nếu hiện ra một số phiên bản (ví dụ `v22.x.x`) là cài thành công.

Phần mềm **Claude Desktop** chính bạn đang dùng để làm việc với tôi ngay bây giờ — không cần cài thêm gì khác cho Claude, chỉ cần mở một cuộc trò chuyện mới và liên kết với thư mục `D:\FAMILY_FINANCE_SUPABASE`.

---

## 4. Tài liệu dự án — đã chuẩn bị sẵn, bạn chỉ cần copy

Claude đã gom toàn bộ tài liệu cần thiết vào:

```
D:\FAMILY_FINANCES\04_SETUP_SUPABASE_MOI\
```

(Đặt tạm trong `D:\FAMILY_FINANCES` vì đó là thư mục duy nhất đang được cấp quyền truy cập cho phiên làm việc này — không phải vì nó thuộc dự án cũ.) Bạn chỉ cần:

1. Mở File Explorer, vào `D:\FAMILY_FINANCES\04_SETUP_SUPABASE_MOI\`.
2. Copy toàn bộ nội dung (chọn hết file + thư mục `docs` bên trong, Ctrl+C).
3. Dán (Paste) vào `D:\FAMILY_FINANCE_SUPABASE\` (thư mục vừa tạo ở Mục 1).
4. (Tuỳ chọn) Sau khi copy xong, có thể xoá thư mục `04_SETUP_SUPABASE_MOI` để dọn lại `D:\FAMILY_FINANCES` gọn như cũ.

Sau khi copy, `D:\FAMILY_FINANCE_SUPABASE\` sẽ có:
- `CLAUDE.md` — nguyên tắc chủ đạo của dự án (Claude sẽ tự đọc file này đầu tiên).
- `docs\REQUIREMENTS_SPECIFICATION.md` — yêu cầu gốc đã được xác nhận.
- `docs\BUSINESS_RULES.md` — toàn bộ quy tắc nghiệp vụ đã chốt (mới nhất, đầy đủ nhất).
- `docs\DATABASE_SCHEMA.md` — cấu trúc dữ liệu hiện tại.
- `docs\UI_UX_GUIDELINES.md` — đặc tả giao diện/trải nghiệm chi tiết (màu, font, bố cục, từng màn hình) để AI code đúng giao diện đã duyệt.
- `docs\MIGRATION_PLAN.md` — kế hoạch triển khai từng giai đoạn.
- `docs\DATA_MIGRATION.md` — quy trình đối soát dữ liệu tham khảo.

**Không cần copy** thư mục `apps-script` (mã nguồn Google Apps Script cũ) — không dùng lại được cho dự án Next.js/Supabase, công nghệ khác hoàn toàn.

---

## 5. Buổi làm việc đầu tiên trên máy mới

1. Mở app **Claude Desktop**.
2. Bắt đầu một cuộc trò chuyện/task **mới**, liên kết với máy laptop này, chọn thư mục `D:\FAMILY_FINANCE_SUPABASE` làm nơi làm việc (connected folder).
3. Gửi đúng nội dung sau cho Claude (copy toàn bộ đoạn trong khung):

```
Đây là dự án Family Finance, tiếp tục từ dự án Apps Script cũ nhưng chuyển
sang kiến trúc Supabase + Vercel. Hãy đọc các file trong thư mục này theo
đúng thứ tự ghi trong CLAUDE.md mục 18, sau đó tóm tắt lại cho tôi hiểu bạn
đã nắm được gì, rồi bắt đầu Giai đoạn 0 theo docs/MIGRATION_PLAN.md
(tạo repo GitHub private, khởi tạo Next.js). Tôi là người không chuyên IT,
giải thích từng bước bằng tiếng Việt, dễ hiểu.
```

4. Claude sẽ đọc tài liệu, tóm tắt lại để bạn xác nhận hiểu đúng, rồi bắt đầu Giai đoạn 0 — có thể tự cài Node.js/Git nếu chưa có, tự tạo repo (sẽ hỏi bạn xác nhận quyền truy cập GitHub khi cần), tự dựng khung dự án Next.js.

---

## 6. Vài điều cần nhớ trong suốt quá trình làm

- **Không bao giờ** đưa dữ liệu tài chính thật (file Excel gốc, export CSV có số tiền thật) lên GitHub — repo chỉ chứa code, không chứa dữ liệu.
- **Không bao giờ** chia sẻ mật khẩu database Supabase hoặc các "API key"/"service role key" cho ai, cũng không dán vào tin nhắn/chat công khai. Nếu Claude cần, nó sẽ hướng dẫn lưu vào file `.env` riêng trên máy bạn (không đưa lên GitHub).
- Mỗi giai đoạn trong `docs/MIGRATION_PLAN.md` kết thúc bằng một báo cáo rõ ràng từ Claude (đã làm gì, test gì, còn thiếu gì) — bạn luôn có thể dừng lại kiểm tra trước khi qua giai đoạn tiếp theo, không bắt buộc làm liên tục một lần.
- Dự án Apps Script cũ ở `D:\FAMILY_FINANCES` **vẫn tiếp tục dùng được như bình thường** trong suốt quá trình xây dự án mới — không có gì bị tắt hay ảnh hưởng cho tới khi bạn xác nhận chuyển hẳn (Giai đoạn 10 trong kế hoạch).
