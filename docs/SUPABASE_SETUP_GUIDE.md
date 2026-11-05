# Hướng dẫn tạo và cấu hình Supabase (từng bước)

Tài liệu này dành cho người không có kiến thức kỹ thuật. Làm lần lượt từ bước 1 đến bước 6.

> **Lưu ý:** Giao diện Supabase thay đổi theo thời gian. Nếu tên nút khác với mô tả, hãy tìm nút có ý nghĩa tương tự. Đừng bỏ qua các bước về mật khẩu và bảo mật.

---

## Bước 1. Tạo project Supabase

1. Vào https://supabase.com và đăng nhập (dùng tài khoản GitHub hoặc Google).
2. Bấm **New project**.
3. Điền:
   - **Name:** `family-finance`
   - **Database Password:** tự đặt một mật khẩu dài, rồi **lưu vào trình quản lý mật khẩu** (ví dụ Google Password Manager). Không gửi mật khẩu này cho ai, kể cả trong chat.
   - **Region:** chọn `Southeast Asia (Singapore)` để nhanh hơn ở Việt Nam.
4. Bấm **Create new project** và đợi vài phút.

## Bước 2. Lấy địa chỉ và khóa kết nối (dùng sau này cho ứng dụng)

1. Trong project, vào **Project Settings → API**.
2. Ghi lại hai giá trị sau (sẽ dán vào file `.env.local` khi làm giao diện):
   - **Project URL** → đây là `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → đây là `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Không** sao chép khóa có tên **`service_role`**. Khóa này có toàn quyền và tuyệt đối không được đưa vào trình duyệt hay GitHub.

## Bước 3. Bật đăng nhập bằng Google

Mỗi người (Cục Thịt, Cục Cá) đăng nhập bằng tài khoản Google riêng.

1. Vào **Authentication → Sign In / Providers → Google** và bật (Enable).
2. Supabase sẽ yêu cầu **Client ID** và **Client Secret** lấy từ Google Cloud Console. Làm theo hướng dẫn chính thức tại: https://supabase.com/docs/guides/auth/social-login/auth-google
3. Trong phần **Authentication → URL Configuration**, đặt **Site URL** là địa chỉ ứng dụng sau này (tạm thời có thể để `http://localhost:3000`).

## Bước 4. Chạy 3 file cấu trúc dữ liệu (quan trọng: đúng thứ tự)

Trong project, vào **SQL Editor → New query**. Với mỗi file dưới đây:

1. Mở file trên máy tính (trong repo GitHub, thư mục `supabase/migrations/`).
2. Copy **toàn bộ** nội dung, dán vào ô soạn thảo SQL.
3. Bấm **Run** (hoặc Ctrl + Enter).
4. Phải thấy thông báo **Success**. Nếu có lỗi màu đỏ, **dừng lại** và gửi nội dung lỗi cho Claude.

Thứ tự bắt buộc:

| Thứ tự | File | Mục đích |
|---|---|---|
| 1 | `0001_init_schema.sql` | Tạo bảng: thành viên, ví, lọ ngân sách, giao dịch, sổ cái |
| 2 | `0002_ledger_functions.sql` | Tạo quy tắc kiểm tra giao dịch và các hàm ghi sổ (thu, chi, chuyển, điều chỉnh, đảo) |
| 3 | `0003_rls.sql` | Bật bảo vệ dữ liệu: chỉ thành viên gia đình mới đọc được |

Không chạy file `scripts/db/00_local_supabase_stub.sql` trên Supabase. File đó chỉ dùng để thử nghiệm trên máy tính cục bộ, vì Supabase đã có sẵn phần xác thực.

## Bước 5. Liên kết tài khoản Google với từng thành viên

Sau khi **mỗi người đăng nhập Google lần đầu** (việc này sẽ làm trong giao diện ứng dụng sau này; tạm thời làm thủ công):

1. Vào **Authentication → Users**. Tìm email Google của từng người và sao chép cột **UID** (một chuỗi dạng `xxxxxxxx-xxxx-...`).
2. Vào **SQL Editor → New query**, dán và chỉnh UID tương ứng, rồi bấm **Run**:

```sql
update family_members
   set auth_user_id = 'DÁN-UID-CỦA-CỤC-THỊT-VÀO-ĐÂY'
 where display_name = 'Cục Thịt';

update family_members
   set auth_user_id = 'DÁN-UID-CỦA-CỤC-CÁ-VÀO-ĐÂY'
 where display_name = 'Cục Cá';
```

Mỗi UID chỉ được gắn cho đúng một thành viên. Sau bước này, chỉ hai tài khoản đó đọc được dữ liệu gia đình.

## Bước 6. Kiểm tra nhanh

Trong **SQL Editor**, chạy câu lệnh sau. Kết quả phải là hai dòng: `Cục Thịt` và `Cục Cá`, và cột `auth_user_id` đã có giá trị.

```sql
select display_name, auth_user_id from family_members order by display_name;
```

Kiểm tra bảo vệ dữ liệu: vào **Table editor**, chọn bảng `transactions`. Nếu bạn đăng nhập bằng tài khoản **không** thuộc gia đình, bảng phải trống. (Kiểm tra này đầy đủ hơn sẽ được thực hiện bằng bộ kiểm thử tự động.)

---

## Các việc cần biết

- **Dữ liệu ví và lọ ngân sách chưa có sẵn.** Chỉ có tên hai thành viên và 6 lọ tạm thời được tạo. Các ví (W001–W008) và số dư đầu sẽ được nhập sau, theo đặc tả đã duyệt.
- **Tạm dừng khi không dùng.** Gói miễn phí của Supabase có thể tạm dừng project sau một thời gian không hoạt động (thông tin từ nguồn bên thứ ba, cần kiểm tra lại trên trang chính thức). Nếu bị tạm dừng, vào Dashboard và bấm **Restore**. Chúng ta sẽ bàn cách tự động giữ project hoạt động ở giai đoạn sau.
- **Sao lưu.** Gói miễn phí không có sao lưu tự động hằng ngày. Việc sao lưu mã hóa lên Google Drive sẽ được làm ở giai đoạn sau.
- **Không chia sẻ** mật khẩu cơ sở dữ liệu, khóa `service_role`, hay file `.env`.
