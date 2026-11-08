# Staff accounts and workspaces

Administrators manage sales and delivery accounts from **Tài khoản nhân viên** (`/staff`). Both roles use the existing `POST /api/v1/auth/login` and `GET /api/v1/auth/me` endpoints. No public staff registration is exposed.

| Resource | Method | Access |
| --- | --- | --- |
| `/api/v1/admin/staff` | GET, POST | ADMIN |
| `/api/v1/admin/staff/{id}` | GET, PUT | ADMIN |
| `/api/v1/admin/staff/{id}/password` | PUT | ADMIN |

Create requires `fullName`, `email`, `role` (`SALES_STAFF` or `DELIVERY_STAFF`) and a password of 12–72 characters, at most 72 UTF-8 bytes. Phone is optional. PUT updates fullName, phone and status (`ACTIVE`/`INACTIVE`); login email and role remain stable. Password changes use a separate subresource and return 204. Passwords are BCrypt hashed and never returned or written to audit payloads. Email uniqueness is case-insensitive. An admin account cannot be changed through these resources.

Creating returns 201 and Location; invalid input returns 400, duplicate email 409, missing staff 404, unauthenticated access 401, and unauthorized access 403. Changing password or status increments the credential version, invalidating old JWTs even if an account is subsequently re-enabled. Existing version-0 admin tokens remain valid through the migration.

## Role parity

- Sales staff retain the shared dashboard, order, customer and inventory screens. They can manage products, bottle types and suppliers, and create/assign/start/cancel/settle delivery trips, matching the demo's store staff permissions. Settings, reports, audit and staff account management remain admin-only.
- Delivery staff use the mobile `/driver` workspace: assigned trips, progress, recipient/address/items, delivery appointment/note, call/maps, delivery success/failure and attempt history, receipts and bottle handover. The backend derives ownership from the authenticated user, not a driver id sent by the client. Drivers cannot access another driver's trip or manage dispatch/assignments/settlements.
- Admin can preview the driver workspace and filter by driver. Real accounts do not use demo records. React Query data is cleared when changing sessions.

## Delivery collections

- `GET /api/v1/delivery/trips/{id}/collections`: receipts, current order balances, expected cash and bottles for handover.
- `POST /api/v1/delivery/trips/{id}/orders/{orderId}/collections`: `{requestId: UUID, amount, method: CASH|BANK_TRANSFER, bottlesReturned}`. ADMIN/SALES_STAFF or the assigned driver only.

Trip/order locks serialize collections. A request UUID is idempotent; reusing it with a different body returns 409. Overpayment is rejected, returned bottles cannot exceed the order's bottle-product quantity, and an empty collection is invalid. Positive amounts create a confirmed payment and SALE allocation, then update order payment status in the same transaction. A transfer should only be recorded after actual receipt. Bottle counts represent physical collection for trip handover; they do not create deposit refunds or modify the customer bottle ledger. Settlement validates collected cash/bottle totals when receipts exist; older trips without receipts retain manual settlement.

V15 adds credential versions, case-insensitive email uniqueness and staff roles. V16 adds delivery collection receipts. No shared/default passwords are committed. On other environments, an admin creates accounts using `/staff` after migrations run.
