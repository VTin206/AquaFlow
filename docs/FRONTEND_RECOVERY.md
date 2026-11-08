# Phục hồi lỗi giao diện

- ErrorBoundary ngoài AppProviders bảo vệ lỗi render từ router/provider/layout và các trang đăng nhập.
- Boundary riêng quanh Outlet của quản trị, tài xế và shop giữ khung điều hướng khi trang con lỗi. Chuyển pathname mới sẽ reset boundary.
- Lỗi render có nút Thử lại, Tải lại trang và Về trang chính. Thử lại chỉ dựng lại cây giao diện, không xóa token/giỏ hàng hoặc tự gửi lại mutation.
- Lỗi lazy import hiển thị hướng dẫn kiểm tra mạng và tải lại thủ công vì React.lazy giữ kết quả import thất bại. Không có vòng lặp tự reload.
- HTML ban đầu có nội dung tải và liên kết tải lại, kể cả khi JavaScript không tải được. Bootstrap bắt lỗi import module khởi động; noscript hướng dẫn bật JavaScript.
- Không hiển thị stack trace, đường dẫn nội bộ hoặc dữ liệu lỗi cho người dùng.

ErrorBoundary xử lý lỗi render/lifecycle và import được React.lazy ném lên. Lỗi API, event handler và tác vụ async vẫn cần xử lý ở mutation/query hoặc try/catch tại nơi gọi; không thay thế toàn ứng dụng bằng màn hình lỗi cho mọi request thất bại.

Kiểm thử: lỗi trang không làm mất menu, retry, đổi trang, lazy import thất bại và không xóa dữ liệu đã lưu. Khi kiểm tra bằng trình duyệt, có thể chặn request JS của một trang chưa mở rồi điều hướng tới trang đó; cần bỏ chặn trước khi tải lại.
