# Delivery REST API

Migration V10 bổ sung chỉ mục và bảo vệ chi tiết hàng trên chuyến khỏi trùng lặp.
Phụ thuộc Dispatch V9; không xuất kho lần hai khi khởi hành.

## Phân quyền

- `ADMIN`: điều phối, phân tài xế, thêm/bỏ đơn, hủy chuyến chưa chạy, khởi hành, ghi kết quả và đối soát.
- `SALES_STAFF`: chỉ đọc danh sách/chi tiết/lịch sử/biên bản để theo dõi.
- `DELIVERY_STAFF`: chỉ đọc, khởi hành và ghi kết quả chuyến được phân cho chính mình.
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
| POST | `/trips/{id}/orders` | `{orderId}`; tạo liên kết đơn, `201` + `Location` |
| GET | `/trips/{id}/orders/{orderId}` | Chi tiết đơn trong chuyến |
| DELETE | `/trips/{id}/orders/{orderId}` | Bỏ đơn khi chuyến chưa chạy; trả chuyến sau cập nhật |
| PUT | `/trips/{id}/departure` | Xác nhận khởi hành, không cần body; gọi lại không tạo thêm hàng trên chuyến |
| POST | `/trips/{id}/orders/{orderId}/attempts` | Tạo lần giao, `201` + `Location` |
| GET | `/trips/{id}/orders/{orderId}/attempts` | Lịch sử giao của đơn trên chuyến |
| GET | `/trips/{id}/orders/{orderId}/attempts/{attemptId}` | Một lần giao |
| PUT | `/trips/{id}/settlement` | Ghi biên bản đối soát một lần, kết thúc chuyến |
| GET | `/trips/{id}/settlement` | Biên bản đối soát (`404` nếu chưa có) |
| GET | `/drivers` | Tài xế đang hoạt động; chỉ ADMIN |
| GET | `/available-orders` | Đơn đã xuất kho và chưa thuộc chuyến hoạt động; chỉ ADMIN |

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
- Chỉ xếp đơn giao tận nơi `OUT_FOR_DELIVERY` có phiếu Dispatch, chưa thuộc chuyến hoạt động khác.
- Khởi hành yêu cầu tài xế active và có đơn. Chi tiết hàng lấy từ phiếu xuất gốc; không trừ tồn lần nữa.
- Giao thành công: đơn `DELIVERED`, ghi thời gian nhận và số hàng đã giao; thanh toán giữ nguyên.
- Giao thất bại: giữ `OUT_FOR_DELIVERY`, bật `delivery_failed`, lưu lý do. Có thể ghi lần giao tiếp trên cùng chuyến.
- Hủy chuyến hoặc đối soát giải phóng liên kết hoạt động, giữ lịch sử. Đơn thất bại có thể xếp chuyến mới với hàng đã xuất.
- Đây là luồng giao lại bằng hàng vẫn đang ở ngoài kho. Nhập hàng hoàn/kiểm hàng hỏng không thuộc API này và không tự cộng tồn.
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
