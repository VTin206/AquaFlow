# Mở lại, trả hàng sau giao, nhật ký theo đơn, loại nước và dung tích

Các API dưới đây mở khóa phần giao diện trước đây ghi "Chưa hỗ trợ" (cờ `reactivate`, `productCatalogDetails` trong
`frontend/src/shared/features.ts`, mục "Nhận trả hàng" và "Nhật ký chi tiết" ở chi tiết đơn). Migration: **V28**.

## 1. Mở lại

Tất cả là `POST`, không có body, idempotent (gọi khi đang hoạt động thì trả bản ghi, không đổi gì). Quyền như chiều ngừng:
ADMIN, SALES_STAFF. Thao tác được ghi nhật ký với hành động `reactivate`.

| Endpoint | Trả về | Từ chối |
| --- | --- | --- |
| `/api/v1/suppliers/{id}/reactivate` | `SupplierResponse` | 404 |
| `/api/v1/bottle-types/{id}/reactivate` | `BottleTypeResponse` | 404 |
| `/api/v1/products/{id}/reactivate` | `ProductResponse` | 404; 409 khi loại vỏ đi kèm còn ngừng lưu hành (lưu hành lại loại vỏ hoặc đổi loại vỏ trước) |
| `/api/v1/sales/customers/{id}/reactivate` | `CustomerResponse` | 404; 409 khi số điện thoại đã thuộc khách đang hoạt động khác, hoặc tài khoản khách đã có hồ sơ khác đang hoạt động |

`GET /api/v1/sales/customers/archived`: hồ sơ đã lưu trữ (`CustomerResponse[]`), theo tên.

## 2. Trả hàng sau giao

Chỉ cho đơn `DELIVERED`/`COMPLETED`. BE chỉ ghi nhận giao đủ, nên số còn trả được của một dòng = số đã đặt − số đã trả.

- `GET /api/v1/sales/orders/{id}/returns` (ADMIN, SALES_STAFF): `{ returns: Response[], items: Returnable[] }`;
  `items[].returnable` là số còn trả được của từng dòng.
- `POST /api/v1/sales/orders/{id}/returns` (**chỉ ADMIN**, SALES_STAFF nhận 403):

```json
{
  "requestId": "uuid",
  "reason": "Bình rò nước",
  "restock": true,
  "lines": [{ "orderItemId": 12, "quantity": 2 }],
  "refund": { "method": "CASH | BANK_TRANSFER", "reference": "bắt buộc khi BANK_TRANSFER" }
}
```

Quy tắc:

- **Giá trị hàng trả** = số lượng × đơn giá × (tiền hàng − giảm giá) / tiền hàng, giống báo cáo doanh thu. Phí giao không hoàn.
- View `order_payment_balances` trừ giá trị này khỏi `total`; cột mới `returned`. Khách đã trả nhiều hơn tổng mới thì phần
  vượt là `refund_due` (trước đây chỉ đơn hủy mới có). `OrderListItem` có thêm `returned`.
- Có số phải hoàn thì **bắt buộc** `refund`. BE tự tính số tiền và tạo phiếu hoàn (OUT) trong cùng giao dịch
  (`refunded`, `refundPaymentId`). Thiếu `refund` thì trả 400 và không lưu gì.
- `restock=true`: nhập lại đúng lô khách đã nhận (giao tận nơi: lần giao thành công; tại quầy: phiếu xuất), lô hạn xa nhất
  trước, ghi phiếu kho `RETURN` theo đơn. Lô đã hết hạn thì không nhập lại được (409), nên nhận trả với `restock=false`.
  `restock=false` là hàng hỏng, không đổi tồn.
- `requestId` gửi lại cùng nội dung trả về phiếu cũ (không trả hàng hay hoàn tiền hai lần). Cùng mã mà nội dung khác thì 409.
- Vượt số còn trả được thì 409; dòng không thuộc đơn hoặc trùng dòng thì 400.
- `POST /sales/orders/{id}/payments` với `direction=OUT` nay cũng nhận đơn chưa hủy đang có `refundDue > 0`.

Vỏ bình và tiền cọc không đổi khi trả hàng; dùng sổ vỏ của khách nếu khách trả kèm vỏ.

## 3. Nhật ký theo đơn

`GET /api/v1/sales/orders/{id}/activity` (ADMIN, SALES_STAFF; 404 nếu không có đơn). Trả về tối đa 500 mốc gần nhất,
cũ trước mới sau:

```json
[{ "kind": "ACTION | PAYMENT", "at": "...", "actorId": 1, "actorName": "...", "action": "transitionStatus",
   "description": "Đổi trạng thái đơn → CONFIRMED", "entityType": "ORDER", "entityId": 12 }]
```

- `ACTION`: dòng `audit_logs` gắn với đơn qua cột mới `order_id`. Gồm thao tác trên đơn, xuất kho, thêm/bỏ khỏi chuyến,
  kết quả giao, kiểm hàng hoàn, trả hàng sau giao (`receive`).
- `PAYMENT`: phiếu thu (`paymentIn`) và phiếu hoàn (`paymentOut`) đã xác nhận.
- V28 gắn `order_id` cho nhật ký cũ của đơn, phiếu xuất, phiếu kiểm hàng hoàn và kết quả giao (lấy số đơn trong mô tả).
  Thao tác trước khi bật nhật ký (V13) thì không có.
- Nhật ký toàn cửa hàng `/api/v1/admin/activity-logs` vẫn chỉ ADMIN xem; trả hàng thuộc khu vực ORDERS.

## 4. Loại nước và dung tích

`ProductResponse` có thêm `waterType` và `volumeMl` (null là chưa nhập). Danh mục công khai cũng trả hai field này.
`CreateProductRequest`/`UpdateProductRequest` nhận thêm:

- `waterType`: `PURIFIED` (Tinh khiết), `MINERAL` (Nước khoáng), `ALKALINE` (Ion kiềm), `REMINERALIZED` (Hoàn lưu khoáng),
  `SPARKLING` (Nước có ga), `ELECTROLYTE` (Bù khoáng & điện giải), `CONTAINER` (Vỏ bình & phụ kiện).
  `UNSPECIFIED` để xóa. Giá trị khác trả 400.
- `volumeMl`: dung tích một chai/bình, 1–100000 ml. `0` để xóa.
- Thiếu field thì giữ nguyên, như `image` và `lowStockThreshold`, để client cũ không xóa mất dữ liệu.

Frontend: sản phẩm chưa nhập thì vẫn đoán từ tên như trước (`catalogFromApi`). Form sản phẩm điền sẵn phần đoán để người
sửa kiểm tra rồi lưu. Quy cách đóng gói vẫn đoán từ tên và đơn vị.
