# Sprint 3 – Delivery Trip API

The assignment-based BE3 contract is documented in [BE3 delivery process](BE3_DELIVERY_PROCESS.md). Its four requested endpoints are available alongside the compatible trip resources below. Each assignment now accepts one outcome; after FAILED, redelivery requires return inspection and a new assignment. Delivery-trip Dispatch endpoints reject COUNTER orders; the legacy sales-order Dispatch endpoint preserves the existing COUNTER handover flow.

All endpoints require a Bearer JWT. `ADMIN` and `SALES_STAFF` manage trips. `DELIVERY_STAFF` may view only trips assigned to their authenticated user and record delivery attempts. The server derives actor IDs from the authenticated principal.

## Trip management

- `POST /api/v1/delivery/trips` creates a `CREATED` trip. The optional driver must be an active `DELIVERY_STAFF` user.
- `GET /api/v1/delivery/trips` lists all trips to store staff and only the signed-in driver's trips to delivery staff.
- `GET /api/v1/delivery/trips/{id}` returns a trip after checking driver ownership.
- `PUT /api/v1/delivery/trips/{id}/driver` assigns an active delivery driver.
- `POST /api/v1/delivery/trips/{id}/orders` assigns a `DELIVERY` order in `PREPARING`:

```json
{ "orderId": 123 }
```

An order can have only one active assignment. `COUNTER` orders and partial assignments are rejected.

## Dispatch and departure

- `POST /api/v1/delivery/trips/{id}/dispatch` processes each active assignment through a separate database transaction. A later assignment failure does not roll back an earlier assignment that already committed. Only `ADMIN` and `SALES_STAFF` can dispatch.
- `POST /api/v1/delivery/trips/{id}/orders/{orderId}/dispatch` dispatches exactly one active assignment in its own transaction. Other assignments on the trip remain independently dispatchable. Only `ADMIN` and `SALES_STAFF` can dispatch.
- A failed-delivery order may be assigned for redelivery only after warehouse return inspection has recorded the physical return. The request is:

```json
{ "orderId": 123, "redelivery": true }
```

The backend verifies prior failed delivery and completed return inspection, creates a new stock reservation, and prepares the order for redelivery in the same transaction. The original dispatch receipt remains immutable. Generic order-status updates cannot reopen a cancelled order.
- `PUT /api/v1/delivery/trips/{id}/departure` starts the trip only after all assigned orders are dispatched. A delivery driver cannot dispatch or edit inventory.

## Attempts and returned goods

- `POST /api/v1/delivery/trips/{id}/orders/{orderId}/attempts` records `SUCCESS` or `FAILED`. Failure requires a reason and timestamp. A failed attempt does not restore inventory. Success changes the order to `DELIVERED` only for a complete dispatched order.
- Drivers can read attempt history for their own assigned trips. Store staff can read all trips.
- Physical return receipt and inspection use `/api/v1/inventory/returns`. Only inspected sellable quantities restore `onHand` and create `RETURN` movements. Damaged goods are excluded from sellable stock.

## Order and trip statuses

`DeliveryTrip` uses `CREATED`, `IN_PROGRESS`, `COMPLETED`, and `CANCELLED`. Trip `COMPLETED` means handover/settlement is complete; order `DELIVERED` means the customer received the full order. Payment, public tracking, `OrderStatus.COMPLETED`, after-sales/refunds and `COUNTER` handover remain outside this contract.
