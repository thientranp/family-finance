# Đẩy code lên Google Apps Script bằng clasp (thay cho chép-dán)

`clasp` là công cụ dòng lệnh chính thức của Google để đồng bộ code giữa máy bạn và Apps Script. Dùng nó thì không cần mở từng file trong trình chỉnh sửa web để dán nữa — mỗi khi tôi sửa code, bạn chỉ chạy một lệnh `clasp.cmd push`.

Làm trên máy cá nhân (đã cài Node.js và Claude Code theo hướng dẫn trước). Mất khoảng 10 phút, chỉ làm một lần.

## Bước 1 — Cài clasp

Mở PowerShell:

```
npm.cmd install -g @google/clasp
clasp.cmd --version
```

Kiểm tra: lệnh thứ hai in ra số phiên bản (ví dụ `3.4.1`), không báo "not recognized". Nếu báo lỗi "running scripts is disabled" (chính sách PowerShell), dùng `clasp.cmd` thay vì `clasp` — mọi lệnh clasp trong hướng dẫn này đều đã viết sẵn dạng `clasp.cmd`.

## Bước 2 — Bật Apps Script API cho tài khoản của bạn

Việc này Google bắt buộc, chỉ bật một lần cho tài khoản Cục Thịt:

1. Đăng nhập Google bằng tài khoản Cục Thịt, mở: https://script.google.com/home/usersettings
2. Bật công tắc **Google Apps Script API**.

## Bước 3 — Đăng nhập clasp

```
clasp.cmd login
```

Trình duyệt tự mở, chọn tài khoản Cục Thịt, bấm **Cho phép**. Quay lại PowerShell thấy "You are logged in as …".

## Bước 4 — Gắn clasp vào đúng dự án Apps Script

Có hai trường hợp:

**Nếu bạn đã tạo dự án Apps Script theo `DEPLOYMENT_GUIDE.md` (bước 2) rồi:**
Lấy **Script ID** của dự án đó: trong trình chỉnh sửa Apps Script → bánh răng **Cài đặt dự án** → chép **Mã tập lệnh (Script ID)**.

Vào thư mục code trên máy bạn (thư mục chứa các file `.gs`, ví dụ `D:\FAMILY_FINANCES\03_AppsScript`), tạo file `.clasp.json`:

```
{"scriptId":"DÁN_SCRIPT_ID_VÀO_ĐÂY","rootDir":"."}
```

**Nếu chưa tạo dự án Apps Script:** đứng trong thư mục đó, chạy:

```
clasp.cmd create --title "Family Finance" --type standalone
```

Lệnh này tự tạo dự án và tự ghi `.clasp.json`. (Bỏ qua bước 1–2 trong `DEPLOYMENT_GUIDE.md`, các bước 3 trở đi vẫn làm như cũ.)

Kiểm tra: thư mục có file `.clasp.json` chứa đúng `scriptId`.

## Bước 5 — Đẩy code lên

```
clasp.cmd push
```

Clasp liệt kê các file đã đẩy: `Core.gs`, `Ledger.gs`, `Budget.gs`, `Assets.gs`, `Reports.gs`, `Config.gs`, `Admin.gs`, `Api.gs`, `Import.gs`, `Tests.gs`, `Index.html`, `appsscript.json`. Nếu hỏi "Manifest file has been updated. Do you want to push and overwrite?", gõ `y`.

Kiểm tra: mở https://script.google.com , vào dự án **Family Finance**, thấy đủ 12 file với nội dung mới.

Từ giờ, mỗi khi có bản code mới, bạn chỉ cần chạy lại `clasp.cmd push` trong thư mục đó — không cần chép-dán tay nữa. Các bước còn lại (thiết lập bảng, chạy kiểm thử, phát hành web app, bật sao lưu) vẫn làm theo `DEPLOYMENT_GUIDE.md` từ bước 3.

## Các lệnh clasp hữu ích khác

| Lệnh | Tác dụng |
|---|---|
| `clasp.cmd open` | Mở dự án trên trình duyệt |
| `clasp.cmd pull` | Tải code từ Apps Script về máy (ngược với push — cẩn thận, sẽ ghi đè file trên máy) |
| `clasp.cmd logs` | Xem nhật ký (Logger.log) ngay trên PowerShell |
| `clasp.cmd deploy` | Tạo bản triển khai mới (vẫn nên làm thủ công theo `DEPLOYMENT_GUIDE.md` bước 5 để chọn đúng quyền truy cập) |

## Lưu ý an toàn

- `clasp.cmd push` ghi đè toàn bộ code trong dự án Apps Script bằng code trên máy bạn — không đụng đến dữ liệu (file Google Sheet DATA) hay dữ liệu đã nhập.
- File `.claspignore` trong thư mục code đã loại các file kiểm thử trên máy (`test/*.js`) và tài liệu `.md`, chỉ đẩy đúng 12 file cần cho Apps Script.
- `.clasp.json` chứa Script ID — không phải bí mật nhạy cảm như mật khẩu, nhưng không cần đưa lên GitHub công khai; repo của dự án đã có `.clasp.json` trong `.gitignore`.
