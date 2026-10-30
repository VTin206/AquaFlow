# Sprint 3 BE1 – Delivery Trip API contract

All endpoints require a Bearer JWT. `ADMIN` and `SALES_STAFF` can manage trips and assignments. `DELIVERY_STAFF` can view only trips whose `driver_id` is their authenticated user ID. The server derives creator/viewer IDs from the authenticated principal; clients cannot provide those IDs.

## Create trip

`POST /api/v1/delivery/trips` (`ADMIN`, `SALES_STAFF`)

```json
{ "driverId": 42 }
```

`driverId` must identify an active user with role `DELIVERY_STAFF`. Returns `201` with a `DeliveryTripResponse`, initially `CREATED`.

## List and detail

- `GET /api/v1/delivery/trips` (`ADMIN`, `SALES_STAFF`) returns all trips, newest first.
- `GET /api/v1/delivery/trips/{id}` (`ADMIN`, `SALES_STAFF`, or the assigned `DELIVERY_STAFF`) returns one trip and its assignments. A driver requesting another driver's trip receives `404`.
- `GET /api/v1/delivery/driver/trips` (`DELIVERY_STAFF`) returns trips assigned to the authenticated driver.

## Update trip

`PATCH /api/v1/delivery/trips/{id}` (`ADMIN`, `SALES_STAFF`)

```json
{ "driverId": 42 }
```

Only the driver can be changed, and only while the trip is `CREATED` and has no active assignments. Trip status and timestamps are system-managed.

## Add order assignment

`POST /api/v1/delivery/trips/{id}/assignments` (`ADMIN`, `SALES_STAFF`)

```json
{ "orderId": 123 }
```

Only `DELIVERY` orders in `PREPARING` can be assigned, only to `CREATED` trips. A database uniqueness guard prevents an order from belonging to more than one active assignment. Assignment does not dispatch stock or change order status.

`DeliveryTripResponse` contains trip ID, driver ID/name, status, system timestamps, creator ID and assignment summaries (assignment ID, order ID/code/status, fulfillment type, recipient name/phone, delivery address/area, active flag and assigned timestamp). Lists are unpaginated because the existing backend has no pagination convention; pagination can be added consistently later if volume requires it.
