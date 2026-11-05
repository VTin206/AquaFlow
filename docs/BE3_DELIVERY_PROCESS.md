# BE3 delivery process

## Public REST contract

All endpoints require a JWT. ADMIN/SALES_STAFF may dispatch and inspect returns. DELIVERY_STAFF may read history and record a result only for their own assigned trip; CUSTOMER cannot access these resources.

| Method | Resource | Result |
| --- | --- | --- |
| POST | `/api/v1/delivery/assignments/{id}/dispatch` | 201 dispatch receipt; Location points to the existing order receipt |
| POST | `/api/v1/delivery/assignments/{id}/attempts` | 201 attempt; Location points to its detail |
| GET | `/api/v1/delivery/assignments/{id}/attempts` | Attempt history, including inactive historical assignments |
| GET | `/api/v1/delivery/assignments/{id}/attempts/{attemptId}` | Scoped attempt detail |
| POST | `/api/v1/delivery/attempts/{id}/return-inspection` | 201 inspection; Location points to inventory return detail |

Dispatch has no required request body. It requires an active assignment on a CREATED trip and a DELIVERY order in PREPARING. It exports every order line in the target assignment transaction. Stock export must succeed before the status becomes OUT_FOR_DELIVERY; any failure rolls the assignment back. Duplicate assignment dispatch returns 409 without another stock movement. COUNTER keeps its legacy handover flow and is not eligible for a delivery assignment.

Attempt body: `{ "outcome": "FAILED", "failureReason": "Customer absent", "note": "..." }`, or `{ "outcome": "SUCCESS", "recipientName": "Actual recipient" }`. The trip must be IN_PROGRESS. The server records the timestamp. Each assignment accepts one outcome; a failed outcome cannot be overwritten by another attempt on the same assignment. Success sets DELIVERED, never COMPLETED. Failure only records the result and flag: no restock or reservation release.

Inspection body: `{ "lines": [{ "loadItemId": 123, "sellable": 2 }], "note": "Condition of damaged goods" }`. The order and assignment are derived from the attempt, not trusted from a client-supplied order id. Only the latest failed attempt on the assignment currently pending warehouse inspection is accepted, after the trip is settled. All loaded batches must be accounted for. Damaged/expired goods are excluded from sellable stock; expired batches cannot be restocked as sellable. Repeating inspection returns 409.

`GET /api/v1/inventory/returns/pending` now includes `attemptId`. The warehouse UI uses it to submit inspection. After inspection the order is CANCELLED; `POST /delivery/trips/{id}/orders` with `{ "orderId": 123, "redelivery": true }` checks completed returns, creates new reservations and a new assignment, and prepares the order. Dispatch again uses the new assignment. Prior receipts, assignments and attempts remain readable.

The existing trip-wide dispatch and trip/order attempt URLs are retained for compatibility and use the same underlying rules. Trip-wide dispatch processes each active assignment independently, so a committed assignment is not rolled back when a later assignment fails; already dispatched orders are skipped without exporting them twice. FE uses assignment attempt APIs, adds a per-order Dispatch button, and submits inspection through the attempt resource.

## Verification

PostgreSQL integration tests cover the new URLs, permissions/ownership, validation, duplicate dispatch/inspection, blocked retry on failed assignment, failure without RETURN, redelivery with a new assignment and two immutable dispatch receipts, and final DELIVERED state. Existing suites cover concurrent dispatch, stock shortage/transaction rollback, damaged/expired returns and generic status-transition restrictions. Frontend adapter tests assert the new paths and request bodies.
