# Khôi phục mật khẩu

## Luồng sử dụng

- Nút **Quên mật khẩu?** ở `/login` và `/shop/account` mở `/forgot-password`.
- Khách nhập email tài khoản AquaFlow; email này là **người nhận**.
- Ứng dụng dùng tài khoản SMTP của cửa hàng làm **người gửi**. Khách không cung cấp mật khẩu Gmail.
- Email chứa liên kết `/reset-password#token=...` dùng một lần, hiệu lực 15 phút.
- Đổi mật khẩu thành công vô hiệu hóa JWT cũ bằng `credentials_version`; người dùng đăng nhập lại.
- Áp dụng cho tài khoản đang ACTIVE của mọi vai trò. Tài khoản không tồn tại hoặc bị khóa nhận cùng phản hồi 202, không gửi thư.

## API

`POST /api/v1/auth/password-reset-requests` — body `{ "email": "customer@example.com" }`, trả 202 với thông báo chung. Trả 400 cho dữ liệu sai, 429 khi vượt giới hạn, 503 khi chưa bật/cấu hình dịch vụ hoặc hàng đợi đầy. Không trả token qua API.

`POST /api/v1/auth/password-resets` — body `{ "token": "...", "password": "..." }`, trả 204 thành công; 400 cho token sai, hết hạn, đã dùng hoặc mật khẩu không hợp lệ; 429 khi thử quá nhiều lần.

V21 lưu SHA-256 của token ngẫu nhiên 256 bit; không lưu token gốc. Lock tài khoản trong transaction để chỉ một yêu cầu dùng được token. Yêu cầu mới thay thế liên kết cũ, cách nhau tối thiểu 60 giây. SMTP thất bại rollback token mới. Token tự mất hiệu lực sau bất kỳ thay đổi credentials_version nào.

Giới hạn mỗi địa chỉ kết nối: 5 yêu cầu gửi thư và 20 lần đặt mật khẩu trong 15 phút. Bộ đếm có giới hạn kích thước, nằm trong tiến trình; triển khai nhiều replica cần bổ sung rate limit dùng chung ở gateway. Không tin X-Forwarded-For do client tự gửi. Reverse proxy cần cấu hình rate limit/forwarded headers đáng tin cậy theo môi trường.

Gửi thư xử lý trong hàng đợi bộ nhớ có giới hạn để phản hồi HTTP không phụ thuộc việc email tồn tại. Hàng đợi không bền qua crash/redeploy; người dùng có thể yêu cầu lại. Log lỗi không chứa email, token hay mật khẩu SMTP. Theo dõi log nếu yêu cầu đã nhận nhưng thư không đến.

## Gmail SMTP

Google: [SMTP và STARTTLS](https://developers.google.com/workspace/gmail/imap/imap-smtp), [tạo App Password](https://support.google.com/mail/answer/185833).

1. Chọn Gmail của cửa hàng, bật xác minh hai bước, tạo App Password nếu tài khoản hỗ trợ. Không dùng mật khẩu đăng nhập Gmail thông thường.
2. Điền cấu hình vào môi trường chạy BE (không commit mật khẩu):

```dotenv
PASSWORD_RESET_ENABLED=true
FRONTEND_URL=http://127.0.0.1:5173
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-store@gmail.com
SMTP_PASSWORD=your-google-app-password
SMTP_FROM=your-store@gmail.com
```

`FRONTEND_URL` phải là địa chỉ FE mà người nhận mở được. Chỉ dùng localhost khi thử trên cùng máy; khi triển khai dùng tên miền HTTPS. Không lấy domain từ header của request.

Ứng dụng mặc định tắt chức năng gửi email cho tới khi cấu hình. File `.env.smtp` ở máy phát triển là chỗ điền giá trị riêng và đã được gitignore; Spring Boot không tự đọc dotenv. Khi chạy Docker cần truyền `--env-file .env.smtp` cùng file cấu hình DB hiện có; thay đổi biến môi trường cần tạo lại container, chỉ restart không áp dụng env mới. Compose production đã ánh xạ các biến SMTP từ file môi trường.

Không bật SMTP thật trong bộ test: integration test dùng database riêng và mock bộ gửi thư, kiểm tra reset/reuse/expiry/concurrency/rollback/quyền đăng nhập.
