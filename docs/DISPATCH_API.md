# Dispatch API

Dispatch xuất toàn bộ hàng đã giữ của một đơn `PREPARING`. Phiếu xuất là tài nguyên bất biến;
chỉ `ADMIN` và `SALES_STAFF` được tạo/xem. JWT bắt buộc. Migration: `V9__order_dispatches.sql`.

| Method | Endpoint | Kết quả |
| --- | --- | --- |
| POST | `/api/v1/sales/orders/{orderId}/dispatches` | `201 Created`, header `Location` trỏ tới phiếu |
| GET | `/api/v1/sales/orders/{orderId}/dispatches` | `200`, mảng rỗng hoặc một phiếu |
| GET | `/api/v1/sales/orders/{orderId}/dispatches/{dispatchId}` | `200`, chi tiết phiếu thuộc đúng đơn |

POST không cần body. Số lượng/lô được lấy từ reservation; người thực hiện lấy từ JWT.
Không nhận số lượng, người thực hiện hay trạng thái từ client.

Ví dụ response:

```json
{
  "id": 21,
  "orderId": 8,
  "performedBy": 1,
  "dispatchedAt": "2026-11-03T10:00:00Z",
  "orderStatus": "OUT_FOR_DELIVERY",
  "items": [
    { "orderItemId": 9, "productId": 12, "batchId": 4,
      "lotCode": "LOT-4", "expiresOn": "2027-01-01", "quantity": 5 }
  ]
}
```

## Quy tắc nghiệp vụ

- Một đơn có tối đa một phiếu; không hỗ trợ xuất từng phần trong phiên bản này.
- Chỉ xuất từ `PREPARING`, khi từng dòng có đủ reservation chưa xuất/chưa giải phóng.
- Xuất đúng lô đã giữ theo FEFO; kiểm tra lại hạn dùng lúc xuất (`expires_on > hôm nay`).
  Lô hết hạn cần xử lý đơn/reservation trước, không tự thay lô khi xuất.
- Giảm `on_hand` và `reserved` cùng số lượng; tăng `quantity_dispatched`.
  Ghi `inventory_movements`, reference `ORDER`, kèm người thực hiện.
- Đơn `DELIVERY`: movement `DISPATCH`, trạng thái `OUT_FOR_DELIVERY`.
- Đơn `COUNTER`: chỉ bấm khi bàn giao hàng thật; movement `COUNTER_SALE`, trạng thái `DELIVERED`.
  Không tự đổi trạng thái thanh toán hoặc chuyển `COMPLETED`.
- Khóa đơn, reservation và tồn kho; toàn bộ ghi dữ liệu trong cùng transaction.
  Thiếu tồn/lỗi bất kỳ lô nào phải rollback cả phiếu, reservation, movement và trạng thái đơn.
- Yêu cầu xuất trùng (kể cả đồng thời hoặc retry sau mất mạng) trả `409` và không trừ tồn lần nữa.
  Client đọc lại danh sách phiếu để đối chiếu kết quả.
- Không thể dùng API đổi trạng thái chung để bỏ qua xuất kho. Không hủy trực tiếp đơn đã xuất.
- Chưa bao gồm điều phối chuyến, phân tài xế, kết quả giao, hàng hoàn hoặc thanh toán.

## Mã lỗi

`401`: chưa đăng nhập. `403`: sai vai trò. `404`: đơn/phiếu không tồn tại hoặc phiếu không thuộc đơn.
`409`: sai trạng thái, đã xuất, reservation thiếu/đã giải phóng, tồn không đủ, lô hết hạn.
ID không phải số trả `400`. Lỗi dùng định dạng `ApiError` chung.

## Frontend

Đơn hàng → Chi tiết → Xác nhận → Chuẩn bị → Xuất kho giao hàng / Xuất kho, giao tại quầy.
Có xác nhận trước khi xuất, trạng thái đang xử lý, hiển thị lỗi và tải lại dữ liệu sau thành công/lỗi.
Phiếu bên dưới chi tiết hiển thị mã phiếu, thời gian, người thực hiện, sản phẩm, lô, hạn dùng và số lượng.
Danh sách đơn và tồn kho được làm mới qua `invalidateLiveData`.

## Kiểm thử

`DispatchPostgresIntegrationTest` cần `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` trỏ tới PostgreSQL test riêng.
Bao gồm nhiều lô, giao tại quầy, hai yêu cầu đồng thời, rollback khi lỗi ở lô sau, hết hạn,
reservation thiếu, phân quyền, REST status/Location, đọc phiếu và chặn đổi trạng thái để bỏ qua xuất kho.
`frontend/tests/dispatch-api.test.mjs` kiểm tra HTTP contract, trạng thái được xuất và lỗi trùng `409`.
