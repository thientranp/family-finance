# Chiến lược kiểm thử

1. **Kiểm thử tự động (36 nhóm)** trong `apps-script/Tests.gs`: thu/chi/chuyển ví, điều chỉnh, đảo, hoàn tiền, nợ vay, tài sản ròng, ngân sách, báo cáo, phân quyền, API, cấu hình, nhắc nhở và thử lại, sao lưu, trigger, toàn vẹn (phát hiện sửa số tiền/ghi chú/xóa dòng/dòng giả), nhập Excel. Có thể chạy hai nơi:
   - Trong Apps Script thật: hàm `runAllTests()` (dùng file Google Sheet tạm, tự xóa).
   - Trên máy dev: `node apps-script/test/run-local.js` (giả lập dịch vụ Google trong bộ nhớ, `test/mock-gas.js`).
2. **Kiểm thử giao diện**: `node apps-script/test/dev-server.js` chạy Index.html với mã `.gs` thật + dữ liệu mẫu; kiểm bằng Playwright ở khổ điện thoại (390px), máy tính (1100px), chế độ tối.
3. **Chưa kiểm được tự động (phải xác nhận trên Google thật)**: nhận diện tài khoản (`getActiveUser`) khi chạy dưới danh nghĩa người dùng truy cập; hạn mức Apps Script; tốc độ ghi hàng nghìn dòng; cấp quyền Drive/UrlFetch; Google Drive for desktop đồng bộ.
4. Dữ liệu kiểm thử là số tổng hợp; dữ liệu thật không lưu trong repo.
