# Danh sách đơn hàng và khách hàng có phân trang

Trước đây `GET /api/v1/sales/orders` và `GET /api/v1/sales/customers` trả toàn bộ bảng; frontend tự lọc và đếm.
Dữ liệu càng nhiều thì càng chậm, và mỗi đơn còn tốn thêm một truy vấn lấy dòng hàng (N+1).
Hai API này nay lọc, tìm và phân trang ở PostgreSQL. Quyền giữ nguyên: ADMIN hoặc SALES_STAFF.

## Quy ước chung

- `page` bắt đầu từ 0 (mặc định 0); `size` từ 1 đến 100 (mặc định 20). Ngoài khoảng: 400.
- Trang vượt quá số trang: `items` rỗng, `total` vẫn đúng.
- Tìm kiếm `q` không phân biệt dấu tiếng Việt (kể cả đ/Đ), chữ hoa/thường và khoảng trắng thừa, giống `matchesSearch` ở frontend.
  Từ khóa trông như số điện thoại (`+84 901 234 567`, `0901-234-567`) còn được so theo chữ số, `+84`/`84` đổi về `0`.
  Ký tự `%` và `_` được tìm đúng nghĩa đen.
- Hàm SQL dùng chung: `af_search_text`, `af_phone_digits` (migration V26, cần extension `unaccent` có sẵn trong ảnh `postgres:16`).

## Đơn hàng

### `GET /api/v1/sales/orders`

| Tham số | Ý nghĩa |
|---|---|
| `status` | Lặp lại được: `?status=PENDING&status=CONFIRMED`. Bỏ trống: mọi trạng thái, kể cả đơn hủy. |
| `fulfillment` | `COUNTER` hoặc `DELIVERY` |
| `payment` | `DUE`: còn phải thu; `SETTLED`: đã thu đủ. Đơn hủy không thuộc cả hai. |
| `q` | Mã đơn, tên/số điện thoại người nhận, tên sản phẩm trong đơn |

Sắp xếp: mới tạo trước (`created_at DESC, id DESC`).

```json
{
  "items": [{ "id": 8, "orderCode": "AF-000008", "status": "DELIVERED", "...": "các trường OrderResponse",
              "paid": 10000, "due": 60000, "refundDue": 0 }],
  "page": 0, "size": 20, "total": 21, "totalPages": 2,
  "statusCounts": { "PENDING": 3, "CONFIRMED": 1, "PREPARING": 0, "OUT_FOR_DELIVERY": 0, "DELIVERED": 5, "COMPLETED": 12, "CANCELLED": 0 }
}
```

Mỗi dòng có đủ trường `OrderResponse` (trải phẳng) cộng `paid`, `due`, `refundDue` từ view `order_payment_balances`,
nên không cần gọi `/sales/order-balances` để ghép công nợ. `statusCounts` đếm trên **toàn bộ** đơn, không theo bộ lọc.

### `GET /api/v1/sales/orders/working-set?days=30`

Không phân trang: đơn còn việc phải làm (chưa `COMPLETED`, chưa `CANCELLED`) cộng đơn tạo trong `days` ngày gần nhất
(1–90, mặc định 30). Dùng cho các màn hình vận hành: đếm đơn chờ xác nhận, Tổng quan, giao hàng, gợi ý khi nhận đơn.
Kích thước không tăng theo số đơn lịch sử. Mỗi dòng có dạng như `items` ở trên.

### `GET /api/v1/sales/customers/{id}/orders`

Toàn bộ lịch sử đơn của một khách, mới nhất trước, dạng như `items` ở trên. 404 khi khách không tồn tại hoặc đã lưu trữ.

## Khách hàng

### `GET /api/v1/sales/customers`

| Tham số | Ý nghĩa |
|---|---|
| `q` | Mã `KH-xxx`, tên, số điện thoại, khu vực, địa chỉ giao của đơn gần nhất |
| `idle` | `all` (mặc định), `7`, `14`, `30`: chưa mua quá N ngày (ngày lịch giờ Việt Nam); `never`: chưa mua lần nào |
| `sort` | `NAME` (mặc định), `ORDERS`, `LAST_ORDER`, `DEBT`, `BOTTLES` |
| `direction` | `ASC` (mặc định) hoặc `DESC`. Khách chưa mua lần nào coi là nhỏ nhất. Trùng giá trị thì theo tên. |

```json
{
  "items": [{ "id": 3, "fullName": "Nguyễn Văn Đức", "phone": "0901234567", "...": "các trường CustomerResponse",
              "orderCount": 3, "lastOrderAt": "2026-11-10T08:00:00+07:00", "lastDeliveryAddress": "99 Lê Lợi",
              "due": 50000, "bottlesHeld": 2, "depositHeld": 100000 }],
  "page": 0, "size": 20, "total": 1, "totalPages": 1,
  "totals": { "customers": 120, "due": 1500000, "bottlesHeld": 85, "depositHeld": 4250000 }
}
```

Số liệu tính cùng quy tắc với các API cũ: `orderCount`/`lastOrderAt`/`lastDeliveryAddress` bỏ đơn hủy;
`due` bỏ đơn chờ xác nhận (như `/sales/customer-balances`); `bottlesHeld`/`depositHeld` như `/sales/bottle-balances`.
`totals` cộng trên **mọi** khách đang hoạt động, không theo bộ lọc.

### `GET /api/v1/sales/customers/{id}`

Trả một khách cùng dạng `items` ở trên (thêm trường so với `CustomerResponse` cũ, không bỏ trường nào).

## Frontend

- Trang Đơn hàng: nhóm "Cần xử lý" và "Đang thực hiện" chỉ gồm đơn chưa xong nên lọc và sắp xếp (giao sớm nhất trước)
  trên tập đơn đang xử lý như trước. Nhóm "Đã xong" và "Tất cả" phân trang ở BE, mới nhất trước, tắt sắp xếp theo cột.
- Trang Khách hàng: tìm, lọc, sắp xếp và phân trang ở BE; khách đã tích để xuất Excel được giữ khi lật trang.
- Tìm nhanh (Ctrl+K) tìm đơn và khách trên toàn bộ dữ liệu ở BE.
- Ô tìm kiếm gọi BE chờ ngừng gõ 300 ms (`useDebouncedValue`).
- Bản dùng thử vẫn lọc dữ liệu mẫu trong trình duyệt, cùng hình dạng dữ liệu với bản thật.
