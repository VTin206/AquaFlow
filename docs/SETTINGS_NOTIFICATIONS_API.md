# Store settings and notifications API

Base URL: `/api/v1`. Protected requests use `Authorization: Bearer <token>`.
Implemented in `feat/be-settings-notifications`. The frontend notification bell uses these APIs.

## Store settings

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| GET | `/store-settings` | ADMIN, SALES_STAFF, DELIVERY_STAFF | 200: current settings and version |
| PUT | `/store-settings` | ADMIN | 200: saved settings and new version |

GET response and PUT body share `settings` and `version`:

```json
{
  "settings": {
    "storeName": "AquaFlow",
    "address": "",
    "phone": "",
    "email": "store@example.com",
    "openingHours": "06:00–21:00",
    "taxCode": "",
    "bankName": "",
    "bankAccount": "",
    "bankHolder": "",
    "invoiceNote": "Cảm ơn quý khách",
    "expiryWarningDays": 30,
    "defaultLowStock": 10
  },
  "version": 0
}
```

Responses additionally contain `updatedAt` (UTC timestamp) and `updatedBy` (user ID, nullable for initial settings).
PUT replaces the settings object; send all desired fields. Optional text fields can be null/omitted.
Required: nonblank storeName (150 characters max), address (500 max, empty allowed), phone
(30 max, digits/spaces/+()/.-, empty allowed), expiryWarningDays (0–3650), defaultLowStock (0–1000000),
and nonnegative version from the latest GET. Email must be valid when provided. Other maximums:
openingHours 200, taxCode 30, bankName/bankHolder 150, bankAccount 50, invoiceNote 1000.

A stale version returns 409; reload and resolve changes before retrying. Save, version increment,
and before/after audit log are atomic. Actor ID comes from JWT, never the request body.
V7 reuses V6's singleton `store_settings` row and adds versioning; existing settings are preserved.
Changing defaultLowStock does not retroactively modify product thresholds. expiryWarningDays is used
by the automatic owner alerts on the next scan. Banking fields are display information, not payment verification.

## Notifications

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| POST | `/admin/notifications` | ADMIN | 201: created notification |
| GET | `/notifications?page=0&size=20&unreadOnly=false` | Authenticated | 200: array of own notifications |
| GET | `/notifications/unread-count` | Authenticated | 200: `{"count":2}` |
| PUT | `/notifications/{id}/read` | Recipient only | 200: notification with readAt |
| PUT | `/notifications/read-all` | Authenticated | 200: `{"updated":2}` |

Create body:

```json
{"recipientId":7,"title":"Thông báo cửa hàng","message":"Cửa hàng đổi giờ mở cửa từ ngày mai."}
```

`recipientId` must be a positive existing user ID. Title is nonblank, max 150; message is nonblank,
max 2000. Text is plain text, not trusted HTML. Response fields:
`id`, `title`, `message`, `createdAt`, `readAt` (null until read), `kind`, `entityType`, `entityId`,
`resolvedAt`. Manual messages have kind MANUAL and null entity/resolution fields.
Sorting: createdAt descending, then id descending. Page is zero-based; size is 1–100.
Empty pages return `[]`. Inbox identity always comes from JWT; no recipient selector is accepted.
Reading another user's notification returns the same 404 as a nonexistent ID.
Repeated mark-read preserves the original readAt; repeated read-all updates zero rows.
Read-all covers unread rows visible to that update, not notifications arriving later.

## Automatic owner alerts

After startup (10 seconds initial delay), a background job scans committed business data every 30
seconds, even when no browser is open. Each active ADMIN account receives its own persistent alert.
Other roles and inactive accounts do not receive these alerts. A user who loses ADMIN access can no
longer read old business alerts, including before the next scan; personal manual messages are unaffected.

| Kind | Condition | Target |
| --- | --- | --- |
| ORDER_PENDING | Order is PENDING, including existing orders on first scan | ORDER / order ID |
| ORDER_OVERDUE | Open DELIVERY order has a requested time strictly before now, without a latest failed attempt | ORDER / order ID |
| DELIVERY_FAILED | Latest attempt on an active assignment is FAILED and the order is still open | ORDER / order ID |
| LOW_STOCK | Active product has available quantity <= its own lowStockThreshold | PRODUCT / product ID |
| BATCH_EXPIRING | Active product's batch has physical stock > 0 and HSD is after today but within expiryWarningDays (inclusive) | BATCH / batch ID |
| BATCH_EXPIRED | Active product's batch has physical stock > 0 and HSD <= today | BATCH / batch ID |

Open orders: PENDING, CONFIRMED, PREPARING, OUT_FOR_DELIVERY. Delivered, completed and cancelled orders
are excluded from late/failed alerts. Failure is read from real delivery_attempts, not the legacy
delivery_failed flag or frontend mock. The current delivery module has no attempt-writing API yet;
failure alerts become usable when that workflow writes real attempts. Return-inspection alerts are
deferred until that workflow supplies reliable state. No payment, email, push or WebSocket integration.

Available stock sums onHand - reserved only for batches expiring after today's Vietnam date, matching
StockService. An active product with no batches has zero available stock. Fully reserved stock still
counts towards expiry alerts because it remains physically present. A zero warning window suppresses
upcoming-expiry alerts but still reports expired stock. Dates use the application Clock (Asia/Ho_Chi_Minh).

One active alert per recipient/source is enforced by a database unique index; a transaction-scoped
advisory lock skips overlapping scans across instances. Refreshes update content but preserve ID,
createdAt and readAt. Reading an alert never causes it to be generated again while its condition remains.
When the condition no longer holds, resolvedAt is set: history remains, but it no longer contributes
to unread count/unreadOnly or read-all. If the condition returns on a later scan, a new unread alert is
created. Changes that begin and end between scans are intentionally not an event history. No daily
reminder spam for conditions that remain active. New ADMIN accounts receive currently active alerts.

Frontend polls every 30 seconds. Clicking an order alert opens live order details; stock/batch alerts
open the inventory page. Resolved alerts display "Không còn cần xử lý". Generation plus UI polling may
take roughly a minute; manual messages retain their previous behavior.

Configuration: `app.notifications.owner-alerts.enabled` (default true), `initial-delay-ms` (10000),
`delay-ms` (30000) under the same prefix. Disable the scheduler for deterministic test fixtures.

## Errors and verification

Standard `ApiError`: 400 invalid body/query, 401 unauthenticated, 403 wrong role, 404 missing
recipient/notification, 409 stale settings or database constraint conflict.
Migrations: V7 settings/inbox, V8 owner alerts. Applied migrations are not modified.

Run `mvn -B -ntp verify` in backend. If a running container mounts backend/target, pass
`-Daquaflow.build.directory=<absolute separate build directory>` so verification cannot overwrite its JAR.
Stop that container before replacing the runtime JAR, then restart and verify health.
WorkspaceControllerTest checks security, validation and JWT
identity selection; WorkspaceServiceTest checks stale saves, ownership lookup and pagination bounds.
WorkspacePostgresIntegrationTest additionally checks JSONB persistence, audit, inbox isolation,
pagination and idempotent reads. Like existing database tests it requires `DB_URL` pointing at an
isolated test database (and DB_USERNAME/DB_PASSWORD); do not use a shared production database.

OwnerAlertPostgresIntegrationTest verifies role isolation, deduplication after read, recovery/recurrence,
appointment boundaries, Vietnam expiry boundaries, reserved/expired stock, latest delivery attempt,
resolution, role revocation and locking across database connections. OwnerAlertServiceTest verifies
the Clock and lock-skip behavior.
