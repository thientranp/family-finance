# Hướng dẫn cài đặt trên laptop cá nhân (Windows)

Mục tiêu: cài đủ công cụ, lấy mã nguồn, khởi tạo Next.js, rồi tiếp tục dự án bằng Claude Code.

Làm lần lượt từ phần 1 đến phần 8. Mỗi bước có điều kiện "xong khi" để bạn tự kiểm tra.

> Chạy lệnh trong **Command Prompt (CMD)** hoặc **PowerShell**. Nếu lệnh `npm` báo lỗi "running scripts is disabled", dùng `npm.cmd` và `npx.cmd` thay cho `npm` và `npx`.

---

## Phần 1. Cài Git for Windows

1. Tải từ https://git-scm.com/downloads/win và cài với mọi tùy chọn mặc định.
2. Mở CMD, kiểm tra:
   ```
   git --version
   ```
   **Xong khi:** hiện số phiên bản, ví dụ `git version 2.x.x`.

## Phần 2. Cài Node.js (bản LTS)

1. Tải bản **LTS** từ https://nodejs.org và cài với mặc định (nhớ tick ô thêm vào PATH nếu có).
2. Đóng hết CMD, mở CMD mới, kiểm tra:
   ```
   node -v
   npm.cmd -v
   npm.cmd view next version
   ```
   **Xong khi:** `node -v` hiện `v22.x` hoặc cao hơn, và lệnh `npm.cmd view next version` in ra một số phiên bản (ví dụ `16.x.x`).

   **Nếu lệnh `npm.cmd view` báo lỗi 403 hoặc lỗi mạng:** dừng lại và gửi nội dung lỗi cho Claude. Không tiếp tục các bước sau.

## Phần 3. Cài Claude Code

1. Mở CMD và chạy:
   ```
   curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
   ```
2. Thêm thư mục cài vào PATH của tài khoản (không cần quyền admin). Mở PowerShell (không chạy quyền Administrator) và dán:
   ```powershell
   $p = [Environment]::GetEnvironmentVariable('Path','User')
   if ($p -notlike '*\.local\bin*') { [Environment]::SetEnvironmentVariable('Path', "$p;C:\Users\$env:USERNAME\.local\bin", 'User') }
   ```
3. Đóng hết CMD và PowerShell, mở CMD mới, kiểm tra:
   ```
   claude --version
   ```
   **Xong khi:** hiện `2.x.x (Claude Code)`.

   Nếu vẫn báo "not recognized", dùng đường dẫn đầy đủ tạm thời: `"%USERPROFILE%\.local\bin\claude.exe" --version`.

## Phần 4. Lấy mã nguồn từ GitHub

1. Chọn thư mục làm việc, ví dụ `C:\Projects`:
   ```
   mkdir C:\Projects
   cd /d C:\Projects
   git clone https://github.com/thientranp/family-finance
   cd family-finance
   git checkout phase-1-supabase-schema
   ```
   Nếu đã gộp vào `main`, bỏ dòng `git checkout`.
2. Lần đầu clone, Git có thể mở cửa sổ đăng nhập GitHub. Đăng nhập bằng tài khoản của bạn.
3. Kiểm tra:
   ```
   git status
   git log --oneline -3
   ```
   **Xong khi:** thấy commit "Phase 1: Supabase schema, ledger functions, RLS and local tests" ở đầu danh sách.

## Phần 5. Chép thư mục tài liệu và dữ liệu nguồn

Các file này không có trên GitHub, phải chép thủ công từ USB:

1. Tạo thư mục `C:\Projects\FAMILY_FINANCES`.
2. Chép hai thư mục con vào đó:
   - `01_Source_Reports` (file Excel gốc, file vay xe, ảnh tài khoản vay)
   - `02_Project_Documents` (đặc tả yêu cầu, kế hoạch triển khai)
3. **Không** chép các file này vào thư mục `family-finance`, và **không** đẩy chúng lên GitHub.

**Xong khi:** `C:\Projects\FAMILY_FINANCES\02_Project_Documents\REQUIREMENTS_SPECIFICATION.md` tồn tại.

## Phần 6. Khởi tạo Next.js trong thư mục con `web`

Đặt ứng dụng vào thư mục `web` để không xung đột với các file có sẵn ở thư mục gốc.

1. Trong thư mục `family-finance`, chạy:
   ```
   npx.cmd create-next-app@latest web
   ```
2. Trả lời các câu hỏi (trình tự có thể khác tùy phiên bản, chọn như sau):
   - TypeScript: **Yes**
   - ESLint: **Yes**
   - Tailwind CSS: **Yes**
   - `src/` directory: **Yes**
   - App Router: **Yes**
   - Turbopack: **Yes** hoặc **No** đều được
   - Import alias: **Yes** (mặc định `@/*`)
   - Gói quản lý: **npm**
3. Kiểm tra chạy được:
   ```
   cd web
   npm.cmd run build
   npm.cmd run dev
   ```
   Mở trình duyệt tại `http://localhost:3000`. **Xong khi:** thấy trang mặc định của Next.js.
4. Dừng máy chủ bằng `Ctrl + C`, rồi quay lại thư mục gốc:
   ```
   cd ..
   ```

## Phần 7. Thêm cấu hình Supabase (không đưa lên GitHub)

1. Tạo file `web\.env.local` (nội dung lấy từ Supabase, Project Settings → API, theo mục 2 của `docs/SUPABASE_SETUP_GUIDE.md`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=dán-khóa-anon-public-vào-đây
   ```
2. **Tuyệt đối không** ghi khóa `service_role` vào đây hoặc vào bất kỳ file nào trong dự án.
3. Kiểm tra file này không bị đưa vào Git:
   ```
   git status
   ```
   **Xong khi:** `web/.env.local` không xuất hiện trong danh sách thay đổi. (`.gitignore` đã chặn `.env.*`.)

## Phần 8. Khởi động Claude Code và tiếp tục dự án

1. Ở thư mục `C:\Projects\family-finance`, chạy:
   ```
   claude
   ```
2. Lần đầu, đăng nhập bằng tài khoản Claude trả phí khi trình duyệt mở ra.
3. Gửi cho Claude câu lệnh sau:
   ```
   Đọc CLAUDE.md, docs/SUPABASE_SETUP_GUIDE.md và docs/SETUP_WINDOWS_LAPTOP.md.
   Tài liệu đặc tả và kế hoạch nằm ở C:\Projects\FAMILY_FINANCES\02_Project_Documents.
   Sau đó cho tôi biết bước tiếp theo theo kế hoạch giai đoạn 1.
   ```

---

## Lưu ý quan trọng

- **Dữ liệu thật** (số dư, giao dịch, file vay) chỉ để trong `C:\Projects\FAMILY_FINANCES`. Không đưa vào repo.
- **Khóa bí mật** (`service_role`, mật khẩu database, file `.env.local`) không bao giờ được commit hoặc gửi trong chat.
- Nếu gặp lỗi ở bất kỳ bước nào, ghi lại đúng bước và nội dung lỗi, rồi gửi cho Claude.
