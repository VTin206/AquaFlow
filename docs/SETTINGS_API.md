# Store settings

- `GET /api/v1/store-settings`: ADMIN, SALES_STAFF, DELIVERY_STAFF.
- `PUT /api/v1/store-settings`: ADMIN only. Body: `{ "settings": { ... }, "version": 0 }`.
- `GET /api/v1/store-profile`: public contact details only (name, address, phone, email, opening hours).

The private response contains `settings`, `version`, `updatedAt`, and `updatedBy`. PUT replaces the settings object, checks the version, increments it, and records the before/after audit in the same transaction. A stale version returns 409; the UI preserves the draft and offers an explicit reload. Invalid input returns 400; missing authentication returns 401 and insufficient permissions return 403.

Store name, address, phone and inventory thresholds are required. Expiry warning days: 1–730; default low stock: 0–1,000,000. Optional blank text becomes null. Bank name, account (6–20 digits), and holder must either all be present or all be absent. Tax code accepts 10 digits with an optional three-digit branch suffix. Phone formatting is normalized and account holder is uppercased.

The default stock threshold applies to new products when the API caller omits a threshold. Explicit zero and existing product thresholds remain unchanged. The FE suggests the current default in the product creation form. Expiry filters use the saved warning days.

Live accounts use persisted settings. Demo accounts continue to use demo data. Bottle exchange and pickup policies remain demo-only. The public profile excludes bank details, tax code and internal inventory settings. No new migration is needed; settings use the existing singleton table and version column.

## Delivery fees

`settings.deliveryFees` = `{ freeFromUnits, smallOrderFee, stairsPerJug }`, used by `POST /api/v1/delivery-quotes` and when a delivery
order is created (orders already created keep their fee). Orders with at least `freeFromUnits` bottles/cases ship free;
smaller orders pay `smallOrderFee`. `stairsPerJug[i]` is the extra fee per bottle carried up to floor `i + 1` by stairs;
higher floors use the last value. Limits: `freeFromUnits` 0–1000, `smallOrderFee` 0–10,000,000, 1–10 floor values of
0–1,000,000 each.

Settings saved before this field existed, and `GET` on them, return the previous fixed rules
`{ 3, 15000, [2000, 4000, 8000, 12000] }`. A `PUT` without `deliveryFees` keeps the current fees, so older clients do
not reset them. Bottle deposits are not a store setting: each bottle type has its own `depositUnitAmount`, and the
delivery slip prints the deposit of the bottle types in the order.
