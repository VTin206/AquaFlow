# AquaFlow — BE2 Inventory Dispatch & Return Contract

Phạm vi: Sprint 3 BE2 trên branch `feature/sprint-3-be2-inventory-dispatch`. BE2 chỉ cung cấp nghiệp vụ tồn kho ở tầng service để Backend Delivery (BE3) gọi; **không có endpoint REST mới**. Các API `/api/v1/delivery/**` thuộc BE3.

Package: `com.aquaflow.inventory.application`

## Nguyên tắc chung

- Mọi hàm ghi đều `@Transactional` với propagation mặc định (`REQUIRED`). BE3 gọi **bên trong transaction của mình** (cùng lúc đổi trạng thái đơn), nên lỗi ở bất kỳ bước nào sẽ rollback toàn bộ: tồn kho, reservation, movement và trạng thái đơn.
- Lỗi nghiệp vụ ném `ConflictException` (`409`); dữ liệu đầu vào sai ném `IllegalArgumentException`. BE3 không cần bắt lại, `GlobalExceptionHandler` đã map.
- BE2 **không biết loại đơn và trạng thái đơn**. BE3 phải tự kiểm tra trước khi gọi: đơn `DELIVERY` (không phải `COUNTER`), trạng thái `PREPARING`, chưa có assignment khác đang hoạt động.
- `performedBy` là id user đang đăng nhập (bắt buộc, FK `users.id`).
- Movement ghi `reference_type = ORDER`, `reference_id = orderId`.

## Luồng tổng quát

```
CONFIRMED  ── StockReservationService.reserve()               (đã có từ Sprint 2)
PREPARING  ── InventoryDispatchService.dispatch()              → BE3 chuyển OUT_FOR_DELIVERY
   giao thành công                                             → BE3 chuyển DELIVERED, không gọi BE2
   giao thất bại   → KHÔNG gọi BE2 (hàng chưa về kho, reservation đã xuất giữ nguyên)
   hàng về kho     ── InventoryDispatchService.findDispatched() (hiển thị để kiểm tra)
                   ── InventoryDispatchService.receiveReturn()  (nhập lại hàng đạt)
   giao lại        ── StockReservationService.reserveForRedelivery()
                   ── InventoryDispatchService.dispatch()      (assignment mới)
```

## `InventoryDispatchService`

### `List<DispatchedLine> dispatch(Long orderId, Collection<Long> orderItemIds, Long performedBy)`

Xuất **toàn bộ** hàng đang giữ của các dòng đơn.

| Bước | Kết quả |
| --- | --- |
| Khóa reservation (`FOR UPDATE`) | Hai request xuất cùng đơn chạy song song: request sau thấy đã xuất và bị `409` |
| Mỗi `orderItemId` phải có reservation chưa xuất | Không có → `409 "chưa được giữ hàng"`; đã xuất/đã giải phóng → `409 "đã được xuất kho hoặc đã giải phóng"` |
| Lô phải còn hạn tại ngày xuất | Hết hạn → `409 "đã hết hạn"` |
| Cập nhật | `onHand -= q`, `reserved -= q`, `quantityDispatched = quantityReserved` |
| Movement | Một dòng `DISPATCH` cho mỗi reservation (mỗi lô) |

- Truyền **tất cả** `orderItemId` của đơn. Không hỗ trợ xuất một phần.
- Kết quả: danh sách lô đã xuất. BE3 có thể dùng để ghi `delivery_load_items` nếu cần.

### `List<DispatchedLine> findDispatched(Collection<Long> orderItemIds)`

Chỉ đọc. Trả về mọi reservation đã xuất của các dòng đơn (kể cả lần giao trước), sắp theo dòng đơn và hạn dùng. Dùng cho màn hình kiểm tra hàng hoàn: hiện `lotCode`, `quantityDispatched` và `quantityUnreturned` (số còn chờ kiểm tra).

### `List<DispatchedLine> receiveReturn(Long orderId, Collection<ReturnLine> lines, String reason, Long performedBy)`

Ghi nhận kết quả kiểm tra hàng hoàn thực tế.

| Quy tắc | Chi tiết |
| --- | --- |
| Đối chiếu | `(orderItemId, batchId)` phải có hàng đã xuất chưa trả về; sai lô → `409 "không có hàng đã xuất chờ trả về"` |
| Số lượng | `resellable + damaged ≤ quantityUnreturned`; vượt → `409` |
| Hàng bán lại được | Cộng vào `onHand` + movement `RETURN` (lưu `reason`) |
| Hàng hư hỏng | Chỉ ghi `quantity_damaged` trên reservation, **không** cộng tồn, không tạo movement |
| Lịch sử | `quantityDispatched` không bao giờ bị giảm |

Có thể gọi nhiều lần (nhận hàng hoàn từng đợt) cho tới khi `quantityUnreturned = 0`.

## `StockReservationService` (thay đổi)

| Hàm | Thay đổi |
| --- | --- |
| `reserve(lines)` | Chỉ chặn khi dòng đơn còn reservation **đang hiệu lực** (còn hàng giữ hoặc hàng đã xuất chưa kiểm tra trả về) |
| `reserveForRedelivery(lines)` **mới** | Giữ hàng mới theo FEFO cho đơn giao lại. Yêu cầu mỗi dòng đã từng xuất kho và đã nhận đủ hàng hoàn (`quantityUnreturned = 0`); sai → `409 "chưa hoàn tất xử lý hàng hoàn"` / `"chưa từng xuất kho"`. Reservation cũ giữ nguyên |
| `release(orderItemIds)` | Chặn khi còn hàng đã xuất chưa trả về; nếu hàng đã trả về đủ thì cho phép hủy đơn |

`ReservationLine(orderItemId, productId, quantity)` không đổi.

## Kiểu dữ liệu

```java
record ReturnLine(Long orderItemId, Long batchId, int resellableQuantity, int damagedQuantity)
// resellable >= 0, damaged >= 0, tổng > 0

record DispatchedLine(Long reservationId, Long orderItemId, Long productId, Long batchId,
                      String lotCode, LocalDate expiresOn,
                      int quantityDispatched, int quantityReturned, int quantityDamaged,
                      int quantityUnreturned)
```

## Ví dụ gọi từ BE3

```java
@Transactional
public void dispatch(Long assignmentId, Long userId) {
    Order order = ...;                       // BE3 kiểm tra DELIVERY + PREPARING + assignment active
    List<Long> itemIds = order.getItems().stream().map(OrderItem::getId).toList();
    inventoryDispatchService.dispatch(order.getId(), itemIds, userId);
    order.transitionTo(OrderStatus.OUT_FOR_DELIVERY);   // lỗi ở đây → rollback cả xuất kho
}
```

## Migration

`V7__stock_reservation_dispatch_and_return.sql` (V1–V6 không đổi):

- Thêm `stock_reservations.quantity_returned`, `quantity_damaged` (mặc định 0), CHECK `returned + damaged ≤ dispatched`.
- Bỏ `UNIQUE (order_item_id, batch_id)` để đơn giao lại được giữ lại đúng lô cũ; thêm index `order_item_id`.

PR BE1 đang dùng `V5__...` (trùng với `V5__product_image.sql` trên `develop`) cần đổi sang **V8** trở lên.

## Ngoài phạm vi

- Endpoint REST cho Dispatch/Attempt/Return-inspection (BE3).
- Ghi `incident_reports` cho hàng hư hỏng; hiện chỉ lưu số lượng trên reservation.
- `delivery_load_items` không được BE2 ghi.
