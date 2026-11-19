# Cấu hình gửi email (Gmail SMTP)

Backend dùng **một Gmail của cửa hàng** để gửi thư cho khách. Gmail này là **người gửi**; khách chỉ là người nhận và không phải cung cấp mật khẩu gì.

Khi đã cấu hình, hai chức năng sau sẽ chạy:

| Chức năng | Biến bật | Khách nhận gì |
| --- | --- | --- |
| Quên mật khẩu | `PASSWORD_RESET_ENABLED=true` | Liên kết đặt lại mật khẩu, hiệu lực 15 phút |
| Xác nhận email khi đăng ký | `REGISTRATION_VERIFY_EMAIL=true` | Mã 6 số, hiệu lực 10 phút |

Chưa cấu hình thì: quên mật khẩu báo "chưa sẵn sàng", còn đăng ký vẫn tạo tài khoản ngay mà không hỏi mã. Máy nào chưa có Gmail vẫn chạy và demo được bình thường.

---

## Bước 1. Chọn Gmail cho cửa hàng

- Nên tạo **một Gmail riêng cho cả nhóm**, ví dụ `aquaflow.cuahang@gmail.com`. Không dùng Gmail cá nhân, vì khách sẽ thấy địa chỉ này trong thư.
- Chọn **một người giữ** tài khoản. Người này làm bước 2 và 3, rồi gửi kết quả cho cả nhóm.
- Dùng Gmail thường (`@gmail.com`). Gmail của trường hoặc công ty thường bị quản trị viên tắt "Mật khẩu ứng dụng", nên có thể không làm được bước 3.

## Bước 2. Bật xác minh 2 bước

Google chỉ cho tạo mật khẩu ứng dụng khi tài khoản đã bật xác minh 2 bước.

1. Đăng nhập Gmail cửa hàng, mở <https://myaccount.google.com/security>.
2. Ở mục **Cách bạn đăng nhập vào Google**, bấm **Xác minh 2 bước** (2-Step Verification).
3. Bấm **Bật**, nhập số điện thoại nhận mã và làm theo hướng dẫn.

## Bước 3. Tạo mật khẩu ứng dụng (App password)

Backend **không dùng mật khẩu đăng nhập Gmail**, mà dùng một mật khẩu 16 ký tự chỉ để gửi mail.

1. Mở <https://myaccount.google.com/apppasswords>. Google có thể hỏi lại mật khẩu.
2. Ô **Tên ứng dụng**: gõ `AquaFlow`, rồi bấm **Tạo**.
3. Google hiện một mật khẩu 16 chữ dạng `abcd efgh ijkl mnop`. **Chép lại ngay**, vì đóng cửa sổ là không xem lại được.
4. Khi điền vào `.env`, viết liền không có dấu cách: `abcdefghijklmnop`.

Nếu không thấy trang này ("The setting you are looking for is not available"), thường là do:
- chưa bật xác minh 2 bước (làm lại bước 2), hoặc
- tài khoản thuộc trường hay công ty và bị tắt chức năng này (chuyển sang Gmail thường), hoặc
- tài khoản đang bật "Chương trình Bảo vệ nâng cao" (Advanced Protection).

Lưu ý: **đổi mật khẩu Gmail thì mọi mật khẩu ứng dụng bị thu hồi**, khi đó phải tạo lại ở bước 3.

## Bước 4. Điền vào `.env`

Mở file `.env` ở **thư mục gốc** của dự án (cùng chỗ với `.env.example`; chưa có thì chép `.env.example` thành `.env`). Sửa các dòng sau:

```dotenv
# Bật quên mật khẩu và mã xác nhận khi đăng ký
PASSWORD_RESET_ENABLED=true
REGISTRATION_VERIFY_EMAIL=true

# Địa chỉ frontend mà khách mở được (liên kết trong mail quên mật khẩu trỏ về đây)
FRONTEND_URL=http://127.0.0.1:5173

# Gmail cửa hàng
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=aquaflow.cuahang@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
SMTP_FROM=aquaflow.cuahang@gmail.com
```

- `SMTP_USERNAME` và `SMTP_FROM` đều là Gmail cửa hàng.
- `SMTP_PASSWORD` là mật khẩu ứng dụng 16 chữ ở bước 3, **không phải** mật khẩu đăng nhập Gmail.
- Chỉ muốn bật một chức năng thì để chức năng kia là `false`.

> ⚠️ **Không commit file `.env`** (Git đã bỏ qua file này). Gửi mật khẩu ứng dụng cho thành viên khác qua tin nhắn riêng. Không dán vào issue, PR hay nhóm chat có người ngoài. Nếu lỡ lộ, vào <https://myaccount.google.com/apppasswords> xóa mật khẩu đó rồi tạo mật khẩu mới.

## Bước 5. Chạy backend với `.env`

Spring Boot **không tự đọc** file `.env`, nên phải nạp biến trước khi chạy. Sau mỗi lần sửa `.env` thì tắt backend rồi chạy lại.

**Git Bash:**

```bash
cd backend
set -a && . ../.env && set +a
mvn spring-boot:run
```

**PowerShell:**

```powershell
cd backend
Get-Content ..\.env | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object {
  $name, $value = $_ -split '=', 2
  Set-Item "env:$($name.Trim())" $value.Trim()
}
mvn spring-boot:run
```

Các biến chỉ có tác dụng trong cửa sổ terminal vừa nạp. Mở terminal mới thì phải nạp lại.

## Bước 6. Kiểm tra

1. **Đăng ký**: mở `/shop/register`, điền form bằng một email bạn đọc được, bấm **Tạo tài khoản**. Cửa sổ **Xác nhận email** hiện ra và mail "AquaFlow - Mã xác nhận đăng ký: 123456" về trong vài giây. Nhập mã là tạo xong tài khoản.
2. **Quên mật khẩu**: ở trang đăng nhập bấm **Quên mật khẩu?**, nhập email tài khoản vừa tạo. Mail có liên kết đặt lại mật khẩu sẽ về.

Không thấy mail thì xem thêm thư mục **Thư rác / Spam**.

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân và cách sửa |
| --- | --- |
| Backend không khởi động, log có `REGISTRATION_VERIFY_EMAIL=true needs SMTP_HOST and SMTP_FROM` | Đã bật mã đăng ký nhưng thiếu `SMTP_HOST` hoặc `SMTP_FROM`. Điền đủ, hoặc đặt `REGISTRATION_VERIFY_EMAIL=false`. |
| Backend không khởi động, log có `Invalid password reset mail configuration` | Đã bật quên mật khẩu nhưng `FRONTEND_URL` sai (phải là `http://127.0.0.1:5173`, `http://localhost:5173` hoặc một địa chỉ `https://...`) hoặc thiếu `SMTP_FROM`. |
| Bấm **Tạo tài khoản** thì báo "Không gửi được email xác nhận" | Backend không đăng nhập được Gmail: sai mật khẩu ứng dụng, còn dấu cách trong mật khẩu, dùng nhầm mật khẩu đăng nhập Gmail, hoặc mật khẩu ứng dụng đã bị thu hồi. Làm lại bước 3 và 4. Log backend có dòng `Registration code email could not be sent`. |
| Không hiện cửa sổ nhập mã, tạo tài khoản luôn | Backend đang chạy chưa có `REGISTRATION_VERIFY_EMAIL=true`. Nạp lại `.env` (bước 5) rồi chạy lại backend. |
| Quên mật khẩu báo "Dịch vụ gửi email khôi phục hiện chưa sẵn sàng" | Chưa có `PASSWORD_RESET_ENABLED=true` trong môi trường đang chạy backend. |
| "Mã vừa được gửi. Vui lòng đợi … giây" | Mỗi email chỉ được gửi lại mã sau 60 giây. Mã đã gửi trước đó vẫn dùng được. |
| "Bạn đã xin mã quá nhiều lần" | Một máy chỉ được xin 10 mã trong 15 phút. Đợi 15 phút hoặc khởi động lại backend (bộ đếm nằm trong bộ nhớ). |
| Mail về chậm hoặc vào Spam | Gmail mới tạo hay bị lọc. Đánh dấu "Không phải thư rác" vài lần. Gmail thường gửi được khoảng 500 thư/ngày, đủ cho demo. |

## Khi triển khai (production)

- Điền cùng các biến trên vào `.env.prod`. `docker-compose.prod.yml` đã chuyển `PASSWORD_RESET_ENABLED`, `REGISTRATION_VERIFY_EMAIL`, `FRONTEND_URL` và `SMTP_*` vào container backend.
- `FRONTEND_URL` phải là tên miền HTTPS thật của cửa hàng.
- Sửa biến môi trường thì phải tạo lại container (`docker compose --env-file .env.prod -f docker-compose.prod.yml up -d`). Chỉ `restart` thì container vẫn dùng biến cũ.

## Tài liệu liên quan

- [CUSTOMER_REGISTRATION.md](CUSTOMER_REGISTRATION.md): luồng đăng ký và API mã xác nhận.
- [PASSWORD_RECOVERY.md](PASSWORD_RECOVERY.md): luồng quên mật khẩu.
- Google: [Đăng nhập bằng mật khẩu ứng dụng](https://support.google.com/mail/answer/185833), [Gmail SMTP](https://developers.google.com/workspace/gmail/imap/imap-smtp).
