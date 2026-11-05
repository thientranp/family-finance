# Hướng dẫn cài đặt trên laptop gia đình (Windows), từng bước

Tài liệu này dẫn bạn từ máy trắng đến khi chạy được dự án. Làm đúng thứ tự, mỗi bước có mục **Xong khi** để bạn tự kiểm tra.

---

## 0. Hiểu trước cấu trúc thư mục

Mọi thứ sẽ nằm trong **D:\FAMILY_FINANCES**:

```
D:\FAMILY_FINANCES\
├── 01_Source_Reports\          ← chép từ USB (file Excel, file vay xe, ảnh)
├── 02_Project_Documents\       ← chép từ USB (đặc tả, kế hoạch)
└── family-finance\             ← mã nguồn, TẢI TỪ GITHUB (bước 4)
    └── web\                    ← ứng dụng Next.js, TẠO Ở BƯỚC 6
```

Hai khái niệm cần biết:

- **Clone** = tải toàn bộ mã nguồn từ GitHub về máy, tạo ra một thư mục mới chứa đủ code. Bạn không cần tạo dự án từ đầu.
- **Mã nguồn (repo)** nằm trên GitHub. **Tài liệu gốc và dữ liệu thật** nằm trên USB. Hai phần này tách riêng, và không đưa tài liệu gốc lên GitHub.

**Cách mở CMD:** nhấn phím `Windows`, gõ `cmd`, bấm **Command Prompt**. Cửa sổ có chữ đen, dòng đầu có dạng `C:\Users\...>`. Các lệnh trong hướng dẫn này đều chạy trong CMD, trừ bước 3.2 (dùng PowerShell).

**Cách dán lệnh:** chuột phải vào cửa sổ CMD để dán, hoặc `Ctrl + V` (trong Windows 10 mới). Sau khi dán, nhấn `Enter`.

---

## Bước 1. Kiểm tra ổ D có tồn tại không

1. Mở CMD, gõ:
   ```
   dir D:\
   ```
2. **Nếu thấy danh sách file/thư mục** → ổ D có. Đi tiếp bước 2.
3. **Nếu báo "The system cannot find the drive specified"** → laptop không có ổ D. Thay tất cả `D:` bằng `C:` trong hướng dẫn này.

**Xong khi:** bạn biết chắc mình dùng `D:` hay `C:`.

---

## Bước 2. Tạo thư mục gốc FAMILY_FINANCES

Trong CMD, gõ lần lượt (mỗi dòng một lệnh, nhấn Enter sau mỗi dòng):

```
D:
mkdir D:\FAMILY_FINANCES
cd /d D:\FAMILY_FINANCES
```

- `D:` chuyển sang ổ D.
- `mkdir` tạo thư mục mới.
- `cd /d` đi vào thư mục đó.

Gõ tiếp:
```
dir
```

**Xong khi:** dấu nhắc hiện `D:\FAMILY_FINANCES>` và lệnh `dir` không báo lỗi (có thể trống).

---

## Bước 3. Cài đặt công cụ

### 3.1. Cài Git

1. Vào https://git-scm.com/downloads/win, tải file cài đặt (tự động chọn bản Windows 64-bit).
2. Mở file vừa tải, bấm **Next** liên tục đến khi **Install**, giữ nguyên mọi tùy chọn mặc định.
3. Bấm **Finish**.
4. **Đóng CMD cũ** (nếu đang mở), mở CMD mới, gõ:
   ```
   git --version
   ```

**Xong khi:** hiện `git version 2.x.x`.

### 3.2. Cài Node.js (bản LTS)

1. Vào https://nodejs.org, bấm nút **LTS** (bản khuyên dùng, không chọn "Current").
2. Mở file cài đặt, bấm **Next** đến hết, giữ mặc định. Đảm bảo ô **Add to PATH** được tick.
3. Đóng CMD, mở CMD mới, kiểm tra:
   ```
   node -v
   npm.cmd -v
   npm.cmd view next version
   ```

**Xong khi:**
- `node -v` hiện `v22.x.x` hoặc cao hơn.
- `npm.cmd view next version` in ra một số phiên bản (ví dụ `16.4.5`).

**Nếu `npm.cmd view` báo lỗi 403 hoặc lỗi mạng:** dừng và gửi tôi toàn bộ nội dung lỗi. Không làm tiếp bước 6.

Lưu ý: nếu gõ `npm -v` mà báo "running scripts is disabled", đó là lỗi PowerShell, không phải lỗi npm. Luôn dùng `npm.cmd` trong CMD thì không gặp lỗi này.

### 3.3. Cài Claude Code

1. Trong CMD, chạy:
   ```
   curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
   ```
2. Đợi đến khi thấy **Installation complete!**.
3. Thêm Claude Code vào PATH cho tài khoản của bạn (không cần quyền admin). Mở **PowerShell** (gõ `PowerShell` trong ô tìm kiếm Windows, bấm mở, **không** chọn "Run as administrator"), rồi dán nguyên khối sau và nhấn Enter:
   ```powershell
   $p = [Environment]::GetEnvironmentVariable('Path','User')
   if ($p -notlike '*\.local\bin*') { [Environment]::SetEnvironmentVariable('Path', "$p;$env:USERPROFILE\.local\bin", 'User') }
   ```
4. Đóng **hết** cửa sổ CMD và PowerShell. Mở CMD mới, kiểm tra:
   ```
   claude --version
   ```

**Xong khi:** hiện `2.x.x (Claude Code)`.

**Nếu vẫn báo "not recognized":** dùng đường dẫn đầy đủ thay thế:
```
"%USERPROFILE%\.local\bin\claude.exe" --version
```

---

## Bước 4. Tải mã nguồn từ GitHub (clone)

Đây là bước tạo thư mục dự án. Lệnh `git clone` sẽ tự tạo thư mục `family-finance` bên trong thư mục hiện tại.

1. Trong CMD, đảm bảo bạn đang ở `D:\FAMILY_FINANCES`:
   ```
   cd /d D:\FAMILY_FINANCES
   ```
2. Tải mã nguồn về:
   ```
   git clone https://github.com/thientranp/family-finance
   ```
   - Lần đầu, Git có thể mở cửa sổ đăng nhập GitHub. Đăng nhập bằng tài khoản GitHub của bạn.
   - Chờ đến khi thấy dòng `done.`
3. Đi vào thư mục vừa tạo, chuyển sang nhánh đúng:
   ```
   cd family-finance
   git checkout phase-1-supabase-schema
   ```
4. Kiểm tra:
   ```
   git log --oneline -3
   ```

**Xong khi:**
- `dir` ở thư mục `D:\FAMILY_FINANCES\family-finance` thấy các mục như `supabase`, `scripts`, `docs`, `README.md`.
- `git log` có dòng đầu tiên là `a3bc754 Docs: Windows laptop setup guide...` hoặc commit mới hơn.

**Nếu `git clone` báo lỗi `destination path already exists`:** thư mục đã có sẵn. Chạy `dir D:\FAMILY_FINANCES`, nếu đã thấy `family-finance` thì chỉ cần `cd family-finance` rồi làm bước 3 của phần này.

---

## Bước 5. Chép tài liệu và dữ liệu gốc từ USB

1. Cắm USB. Giả sử USB là ổ `E:` (xem trong **This PC**). Kiểm tra trong CMD:
   ```
   dir E:\
   ```
   Thay `E:` bằng ký tự ổ USB thực tế của bạn.
2. Chép hai thư mục (dùng lệnh sau, thay `E:` nếu cần):
   ```
   xcopy "E:\FAMILY_FINANCES\01_Source_Reports" "D:\FAMILY_FINANCES\01_Source_Reports\" /E /I
   xcopy "E:\FAMILY_FINANCES\02_Project_Documents" "D:\FAMILY_FINANCES\02_Project_Documents\" /E /I
   ```
   Nếu USB không có sẵn thư mục `FAMILY_FINANCES` ở gốc, mở USB bằng File Explorer và kéo-thả hai thư mục con vào `D:\FAMILY_FINANCES`.
3. Kiểm tra:
   ```
   dir D:\FAMILY_FINANCES\02_Project_Documents
   ```

**Xong khi:** thấy file `REQUIREMENTS_SPECIFICATION.md` và `IMPLEMENTATION_PLAN.md`, và thư mục `01_Source_Reports` có file Excel.

**Lưu ý:** các file này **không** được đặt trong `family-finance` và **không** được commit lên GitHub.

---

## Bước 6. Tạo ứng dụng Next.js trong thư mục `web`

1. Đảm bảo bạn đang ở thư mục repo:
   ```
   cd /d D:\FAMILY_FINANCES\family-finance
   ```
2. Chạy lệnh tạo Next.js:
   ```
   npx.cmd create-next-app@latest web
   ```
3. Trả lời các câu hỏi xuất hiện (chọn theo bảng sau; các câu hỏi có thể khác chút tùy phiên bản):

   | Câu hỏi | Chọn |
   |---|---|
   | Would you like to use TypeScript? | **Yes** |
   | Would you like to use ESLint? | **Yes** |
   | Would you like to use Tailwind CSS? | **Yes** |
   | Would you like your code inside a `src/` directory? | **Yes** |
   | Would you like to use App Router? | **Yes** |
   | Would you like to use Turbopack? | **Yes** (hoặc No, đều được) |
   | Would you like to customize the import alias? | **No** (mặc định `@/*`) |
   | Which package manager? | **npm** |

4. Khi cài xong, kiểm tra ứng dụng chạy được:
   ```
   cd web
   npm.cmd run build
   ```
   Đợi đến khi thấy dòng `Compiled successfully` hoặc bảng thống kê trang, không có chữ `Failed`.

5. Chạy thử trên trình duyệt:
   ```
   npm.cmd run dev
   ```
   Mở trình duyệt, vào `http://localhost:3000`. Thấy trang mặc định của Next.js là thành công.
6. Dừng máy chủ: nhấn `Ctrl + C`, gõ `Y` nếu được hỏi, rồi Enter.
7. Quay về thư mục repo:
   ```
   cd ..
   ```

**Xong khi:** `npm.cmd run build` thành công và trang `localhost:3000` hiện được.

---

## Bước 7. Thêm cấu hình Supabase (chỉ làm trên máy gia đình)

1. Lấy hai giá trị từ Supabase: vào project, **Project Settings → API**:
   - **Project URL** (dạng `https://xxxxxxxx.supabase.co`)
   - **anon public key** (chuỗi dài, **không** phải khóa `service_role`)
2. Mở **Notepad**, dán nội dung sau, thay hai giá trị:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=dán-khóa-anon-vào-đây
   ```
3. Lưu file với tên **đúng** là `.env.local` vào thư mục `D:\FAMILY_FINANCES\family-finance\web`:
   - Trong Notepad, chọn **File → Save As**.
   - Ô **Save as type**: chọn **All Files (*.*)**.
   - Ô **File name**: gõ `.env.local` (có dấu chấm ở đầu).
   - Đường dẫn: `D:\FAMILY_FINANCES\family-finance\web`.
4. Kiểm tra file không bị đưa vào Git:
   ```
   cd /d D:\FAMILY_FINANCES\family-finance
   git status
   ```
   **Xong khi:** `.env.local` **không** xuất hiện trong danh sách.

**Không bao giờ** ghi khóa `service_role` vào file này.

---

## Bước 8. Khởi động Claude Code và tiếp tục dự án

1. Trong CMD:
   ```
   cd /d D:\FAMILY_FINANCES\family-finance
   claude
   ```
2. Lần đầu, trình duyệt sẽ mở để bạn đăng nhập tài khoản Claude (gói trả phí). Đăng nhập và cho phép kết nối.
3. Khi có dấu nhắc của Claude Code, gõ:
   ```
   Đọc CLAUDE.md, docs/SUPABASE_SETUP_GUIDE.md và docs/SETUP_WINDOWS_LAPTOP.md.
   Tài liệu đặc tả và kế hoạch nằm ở D:\FAMILY_FINANCES\02_Project_Documents.
   Sau đó cho tôi biết trạng thái dự án và bước tiếp theo.
   ```

**Xong khi:** Claude trả lời và tóm tắt được trạng thái dự án.

---

## Tóm tắt: các thư mục sau khi làm xong

| Thư mục | Chứa gì | Nguồn |
|---|---|---|
| `D:\FAMILY_FINANCES\01_Source_Reports` | File Excel, file vay xe, ảnh | Chép từ USB |
| `D:\FAMILY_FINANCES\02_Project_Documents` | Đặc tả, kế hoạch | Chép từ USB |
| `D:\FAMILY_FINANCES\family-finance` | Mã nguồn dự án | `git clone` từ GitHub |
| `D:\FAMILY_FINANCES\family-finance\web` | Ứng dụng Next.js | Tạo ở bước 6 |

---

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `'git' is not recognized` | Chưa cài Git, hoặc chưa mở CMD mới sau khi cài | Cài lại Git (bước 3.1), mở CMD mới |
| `running scripts is disabled` | Đang dùng PowerShell với lệnh `npm` | Dùng `npm.cmd` thay `npm` |
| `403` khi chạy `npm.cmd` | Chính sách mạng chặn npm | Dừng, gửi tôi nội dung lỗi |
| `'claude' is not recognized` | Chưa thêm PATH | Làm bước 3.3, hoặc dùng đường dẫn đầy đủ |
| `destination path already exists` | Đã clone rồi | `cd family-finance` rồi tiếp tục |

Nếu gặp lỗi không có trong bảng, ghi lại **đúng bước** và **nguyên văn nội dung lỗi**, rồi gửi cho tôi.
