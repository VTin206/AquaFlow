# Phiên đăng nhập: access token và refresh token

Trước đây đăng nhập chỉ trả một JWT sống 60 phút, lưu trong `localStorage`. Hết giờ là bị đăng xuất giữa ca,
có khi đang điền dở form. Nay phiên gồm hai phần:

| | Access token (JWT) | Refresh token |
|---|---|---|
| Thời hạn | 15 phút (`JWT_EXPIRATION_MINUTES`) | 14 ngày không dùng (`REFRESH_TOKEN_DAYS`), tính lại mỗi lần làm mới |
| Nơi giữ | `localStorage`, gửi trong header `Authorization` | Cookie `af_refresh`: `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` |
| JavaScript đọc được | Có | Không (mã độc chèn vào trang cũng không lấy được) |
| Lưu ở server | Không | Chỉ SHA-256 trong bảng `refresh_tokens` (migration V27) |

## API

- `POST /api/v1/auth/login`: như cũ (body có `accessToken`, `expiresIn`, `user`), thêm header `Set-Cookie: af_refresh=...`.
  Refresh token không có trong body.
- `POST /api/v1/auth/refresh`: không cần body hay `Authorization`, trình duyệt tự gửi cookie.
  200: body như đăng nhập (kèm `user` mới nhất) và cookie mới. 401: phải đăng nhập lại.
- `POST /api/v1/auth/logout`: thu hồi phiên của cookie đang gửi và xóa cookie. Luôn trả 204.

## Quy tắc bảo mật

- **Xoay vòng:** mỗi lần làm mới, refresh token cũ bị thu hồi, token mới cùng "family" (cùng lần đăng nhập).
- **Phát hiện bị đánh cắp:** token đã thu hồi bị dùng lại sau 30 giây thì thu hồi cả family. Kẻ gian lẫn người dùng
  đều phải đăng nhập lại.
- **Hai tab cùng làm mới:** tab chậm gửi token vừa bị thay trong vòng 30 giây chỉ bị từ chối, không làm mất phiên,
  và phản hồi không xóa cookie (cookie có thể đã là token mới của tab kia). Frontend chờ một chút rồi dùng token tab kia vừa lưu.
- **Đổi/đặt lại mật khẩu, khóa tài khoản:** `credentials_version` của user tăng nên mọi refresh token cấp trước đó hết hiệu lực
  (không cần thêm bước thu hồi ở các luồng đó).
- **Đăng xuất** chỉ kết thúc phiên trên trình duyệt đó; đăng nhập ở máy khác là phiên riêng.

## Frontend

- Request bị 401: làm mới **một lần** (nhiều request cùng lúc dùng chung một lần làm mới), rồi gửi lại với token mới.
  Không làm mới được thì mới đăng xuất. Lỗi mạng/máy chủ khi làm mới thì giữ phiên.
- Làm mới chủ động 1 phút trước khi access token hết hạn.
- Mở lại app khi access token đã hết hạn: xóa ngay thông tin người dùng trên máy (máy dùng chung không lộ thông tin
  người trước), rồi khôi phục phiên và người dùng từ `/auth/refresh` nếu cookie còn hiệu lực. Trong lúc chờ, trang cần
  đăng nhập để trống thay vì đẩy về trang đăng nhập.

## Triển khai

- Cookie `Secure` chỉ được gửi qua HTTPS (trình duyệt cho phép ngoại lệ với `http://localhost` khi phát triển).
  **Nếu chạy prod bằng HTTP trơn**, đặt `REFRESH_COOKIE_SECURE=false`; nếu không người dùng bị đăng xuất sau 15 phút.
  Nên dùng HTTPS: không có HTTPS thì cả mật khẩu lẫn token đều đi dạng rõ trên mạng.
- Frontend và API phải cùng origin (Nginx proxy `/api/` như hiện tại, hoặc proxy của Vite khi dev) để cookie
  `SameSite=Strict` được gửi kèm.
- Migration V27 nối tiếp V26 (nhánh phân trang danh sách). Merge nhánh phân trang trước để Flyway áp đúng thứ tự trên DB đang chạy.
