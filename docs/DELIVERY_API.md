# Delivery REST API

Migration V10 bổ sung chỉ mục và bảo vệ chi tiết hàng trên chuyến khỏi trùng lặp.
Phụ thuộc Dispatch V9; không xuất kho lần hai khi khởi hành.

## Phân quyền

- `ADMIN`, `SALES_STAFF`: tạo và cập nhật Trip, phân tài xế, thêm/bỏ đơn, Dispatch, hủy chuyến chưa chạy và đối soát.
- `DELIVERY_STAFF`: chỉ đọc Trip được giao, khởi hành và ghi kết quả giao.
- JWT bắt buộc; danh sách của tài xế được lọc bằng user ID phía server, không nhận tên/ID tài xế từ client để bỏ qua kiểm tra quyền.

## Tài nguyên

Base `/api/v1/delivery`.

| Method | Path | Kết quả |
| --- | --- | --- |
| GET | `/trips` | Danh sách chuyến theo quyền |
| POST | `/trips` | Tạo chuyến, `201` + `Location`; body `{driverId?, vehicle?}` |
| GET | `/trips/{id}` | Chi tiết chuyến, đơn, hàng theo lô và biên bản đối soát |
| PATCH | `/trips/{id}` | `{status: "CANCELLED"}`; chỉ hủy chuyến `CREATED` |
| PUT | `/trips/{id}/driver` | `{driverId}`; tài xế phải active và có role DELIVERY_STAFF |
| POST | `/trips/{id}/orders` | `{orderId}`; gán đơn DELIVERY đang PREPARING, `201` + `Location` |
| POST | `/trips/{id}/dispatch` | Dispatch lần lượt từng Assignment active; mỗi Assignment có transaction riêng |
| POST | `/trips/{id}/orders/{orderId}/dispatch` | Dispatch đúng Assignment này, độc lập với các đơn khác trong Trip; `201` + `Location` |
| GET | `/trips/{id}/orders/{orderId}` | Chi tiết đơn trong chuyến |
| DELETE | `/trips/{id}/orders/{orderId}` | Bỏ đơn khi chuyến chưa chạy; trả chuyến sau cập nhật |
| PUT | `/trips/{id}/departure` | Xác nhận khởi hành, không cần body; gọi lại không tạo thêm hàng trên chuyến |
| POST | `/trips/{id}/orders/{orderId}/attempts` | Tạo lần giao, `201` + `Location` |
| GET | `/trips/{id}/orders/{orderId}/attempts` | Lịch sử giao của đơn trên chuyến |
| GET | `/trips/{id}/orders/{orderId}/attempts/{attemptId}` | Một lần giao |
| PUT | `/trips/{id}/settlement` | Ghi biên bản đối soát một lần, kết thúc chuyến |
| GET | `/trips/{id}/settlement` | Biên bản đối soát (`404` nếu chưa có) |
| GET | `/drivers` | Tài xế đang hoạt động; chỉ ADMIN |
| GET | `/available-orders` | Đơn DELIVERY đang PREPARING hoặc đủ điều kiện redelivery sau kiểm nhận; chỉ ADMIN/SALES_STAFF |

Kết quả giao:

```json
{ "outcome": "SUCCESS", "recipientName": "Nguyễn An", "note": "Đã bàn giao" }
```

Hoặc `{ "outcome": "FAILED", "failureReason": "Khách vắng nhà" }`.
Thành công bắt buộc người nhận; thất bại bắt buộc lý do. Đơn thành công không ghi thêm lần giao.

Đối soát:

```json
{ "cashReported": 100000, "cashConfirmed": 100000,
  "bottlesExpected": 3, "bottlesConfirmed": 3, "note": "Đã bàn giao" }
```

Tiền và vỏ không âm; tiền tối đa 12 chữ số nguyên, 2 chữ số thập phân.
Có chênh lệch phải ghi chú. Phải có kết quả cho mọi đơn trước khi đối soát.
Biên bản ghi số liệu bàn giao thực tế, chưa thay thế module thanh toán/công nợ/sổ vỏ.

## Trạng thái và tồn kho

- Chuyến: `CREATED → IN_PROGRESS → COMPLETED`; `CREATED → CANCELLED`.
- Chỉ xếp đơn `DELIVERY` đang `PREPARING` vào Trip `CREATED`; một đơn không được có Assignment hoạt động thứ hai.
- Chỉ Dispatch khi Trip có tài xế `DELIVERY_STAFF` đang hoạt động. Endpoint Trip-wide gọi từng Assignment bằng transaction riêng.
- Dispatch riêng Assignment yêu cầu chính đơn đó đang `PREPARING` và Assignment thuộc Trip mục tiêu, active; thất bại ở Assignment khác không rollback đơn đã Dispatch trước đó.
- API Dispatch theo đơn cũng kiểm tra Assignment hoạt động, Trip `CREATED` và tài xế hợp lệ; không thể xuất DELIVERY trước khi gán Trip.
- Khởi hành yêu cầu tài xế active, có đơn và mọi đơn đã Dispatch. Chi tiết hàng lấy từ phiếu xuất gốc; không trừ tồn lần nữa.
- Giao thành công: đơn `DELIVERED`, ghi thời gian nhận và số hàng đã giao; thanh toán giữ nguyên.
- Giao thất bại: giữ `OUT_FOR_DELIVERY`, bật `delivery_failed`, lưu lý do. Có thể ghi lần giao tiếp trên cùng chuyến.
- Hủy Trip trước Dispatch giải phóng Assignment, giữ đơn `PREPARING` để điều phối lại.
- Đơn giao thất bại chỉ được xếp giao lại sau khi kho nhận và kiểm tra hàng hoàn; hàng bán được cần reservation mới, lịch sử Dispatch cũ được giữ nguyên.
- Các thao tác ghi khóa chuyến; thêm đơn còn khóa đơn. Unique index ngăn một đơn xuất hiện ở hai chuyến hoạt động.

## Lỗi và FE

`400`: dữ liệu thiếu/sai; `401`: chưa đăng nhập; `403`: sai quyền hoặc truy cập chuyến của tài xế khác;
`404`: không có tài nguyên; `409`: trạng thái xung đột, đơn đã được xếp, lặp kết quả thành công hoặc đối soát.

FE `/delivery` và `/driver` gọi API thật cho tài khoản thật; demo vẫn dùng dữ liệu mẫu.
Giao diện có trạng thái tải, lỗi/thử lại, danh sách rỗng và làm mới sau thao tác; tự tải lại chuyến mỗi 15 giây.
Tài xế có danh sách sản phẩm/lô/số lượng, nút gọi, chỉ đường và ghi kết quả; lịch sử giao đọc từ API.

## Kiểm thử

`DeliveryPostgresIntegrationTest` chạy khi có `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` trỏ tới PostgreSQL test riêng.
Bao phủ luồng thành công/thất bại/giao lại/đối soát, hủy chuyến, trạng thái không hợp lệ,
quyền theo tài xế và role, HTTP 201/Location, validation, chống nhân đôi hàng lúc khởi hành,
và hai chuyến đồng thời tranh một đơn. Các test giao hàng không tạo payment hoặc nhập lại tồn.

FE: `npm test` kiểm tra adapter gửi đúng method/path/body và giữ nguyên lỗi 403.
Kiểm tra thủ công: đăng nhập ADMIN → xuất kho đơn DELIVERY → Giao hàng → tạo chuyến →
phân tài xế → thêm đơn → khởi hành; đăng nhập tài xế để ghi kết quả; ADMIN đối soát.
