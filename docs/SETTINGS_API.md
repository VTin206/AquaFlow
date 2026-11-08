# Store settings

- `GET /api/v1/store-settings`: ADMIN, SALES_STAFF, DELIVERY_STAFF.
- `PUT /api/v1/store-settings`: ADMIN only. Body: `{ "settings": { ... }, "version": 0 }`.
- `GET /api/v1/store-profile`: public contact details only (name, address, phone, email, opening hours).

The private response contains `settings`, `version`, `updatedAt`, and `updatedBy`. PUT replaces the settings object, checks the version, increments it, and records the before/after audit in the same transaction. A stale version returns 409; the UI preserves the draft and offers an explicit reload. Invalid input returns 400; missing authentication returns 401 and insufficient permissions return 403.

Store name, address, phone and inventory thresholds are required. Expiry warning days: 1–730; default low stock: 0–1,000,000. Optional blank text becomes null. Bank name, account (6–20 digits), and holder must either all be present or all be absent. Tax code accepts 10 digits with an optional three-digit branch suffix. Phone formatting is normalized and account holder is uppercased.

The default stock threshold applies to new products when the API caller omits a threshold. Explicit zero and existing product thresholds remain unchanged. The FE suggests the current default in the product creation form. Expiry filters use the saved warning days.

Live accounts use persisted settings. Demo accounts continue to use demo data. Sample delivery policies remain demo-only. The public profile excludes bank details, tax code and internal inventory settings. No new migration is needed; settings use the existing singleton table and version column.
