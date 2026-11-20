# Hình thức thanh toán của đơn web (đề xuất contract)

Trạng thái: **đề xuất từ FE, chờ backend (module order) duyệt và làm**. Frontend đã gửi và đọc trường này; backend
hiện tại bỏ qua trường lạ nên chưa có gì thay đổi khi chạy.

## Vấn đề

Trang đặt hàng cho khách chọn "Trả khi nhận hàng" hoặc "Chuyển khoản trước", nhưng backend không lưu lựa chọn này.
FE đang ghi nó vào đầu ghi chú đơn (`Muốn chuyển khoản trước`). Vì không có trường riêng, trang đơn của khách hiện mã QR
chuyển khoản cho mọi đơn còn nợ, kể cả đơn khách đã chọn trả khi nhận hàng.

## Đề xuất

### Database (migration Flyway mới)

```sql
ALTER TABLE orders ADD COLUMN payment_method VARCHAR(16)
    CHECK (payment_method IN ('COD', 'TRANSFER'));
```

- Cho phép `NULL`: đơn cũ và đơn tạo tại quầy không có lựa chọn.
- Không backfill từ ghi chú.

### Request

`POST /api/v1/customer/orders` và `POST /api/v1/customer/orders/guest` nhận thêm trường không bắt buộc:

```json
{ "paymentMethod": "COD" }
```

- Giá trị: `COD` (trả khi nhận hàng) hoặc `TRANSFER` (chuyển khoản trước).
- Thiếu trường thì lưu `COD`.
- Gửi `TRANSFER` khi cửa hàng chưa cấu hình tài khoản nhận chuyển khoản: trả `400` (FE đã khóa lựa chọn này khi
  chưa có tài khoản).

### Response

`OrderResponse` (staff, khách) và `PublicOrderResponse` (tra cứu đơn) trả thêm:

```json
{ "paymentMethod": "TRANSFER" }
```

`null` với đơn cũ hoặc đơn tại quầy.

## Frontend dùng thế nào

- Trang đặt hàng gửi `paymentMethod` theo lựa chọn của khách (vẫn ghi vào ghi chú cho tới khi backend lưu trường này).
- Trang đơn của khách chỉ hiện QR chuyển khoản khi `paymentMethod` khác `COD`. Đơn chưa có trường (`null`/thiếu)
  vẫn hiện QR như hiện tại.

## Câu hỏi mở cho backend

- Khách đã chọn `COD` có được đổi sang `TRANSFER` sau khi đặt không (ví dụ nút "Chuyển khoản thay")? Nếu có, cần
  endpoint riêng, ví dụ `PATCH /api/v1/customer/orders/{id}/payment-method`.
- Nhân viên có cần đổi hình thức này trên đơn không?
