# Customer account and address book

Only authenticated `CUSTOMER` accounts can access these endpoints. The backend resolves the active customer from the authenticated user's ID; no customer/user ID is accepted from the client.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/v1/customer/account/profile` | Read own name, login email and phone |
| PUT | `/api/v1/customer/account/profile` | Replace `fullName` and `phone`; update User and Customer in one transaction |
| GET | `/api/v1/customer/account/addresses` | List own addresses |
| POST | `/api/v1/customer/account/addresses` | Create address; returns 201 and Location |
| GET | `/api/v1/customer/account/addresses/{id}` | Read own address |
| PUT | `/api/v1/customer/account/addresses/{id}` | Replace own address |
| DELETE | `/api/v1/customer/account/addresses/{id}` | Delete own address; returns 204 |

Address input: `recipientName`, `recipientPhone`, `addressLine`, `area`, `isDefault`. Phone numbers are normalized to the local `0...` format. Name/address/area are trimmed and validated. Another customer's address returns 404 for read, update and delete. Unauthenticated access returns 401; staff roles return 403. Missing/inactive customer profiles return 404. Duplicate active customer phone returns 409; records are never linked by phone.

The existing address service handles default promotion: the first address becomes default; choosing a new default clears the old one; deleting the default promotes the oldest remaining address. Account address writes lock the customer row to serialize simultaneous operations. Existing unique database constraints remain in force. No migration is needed.

Email, role, status, credentials, internal notes and customer category cannot be modified through the profile endpoint. Password recovery is a separate feature.

## UI verification

1. Sign in as a real customer, open `/shop/account`, edit name/phone and save. The account header updates; refresh retains the saved data.
2. Add two addresses, edit one, choose a default and delete it. Verify the remaining address becomes default.
3. Open checkout with items in the cart. Select a saved address to fill recipient, phone, address and area. Selection is explicit so loading addresses never overwrites a delivery form the customer is already editing.
4. Submit the order; it retains the entered delivery snapshot independently of later address edits/deletion.
5. Simulate API errors: profile/address forms retain input; the address list supports retry; checkout still allows manual entry.

Automated coverage includes real PostgreSQL/MockMvc account isolation and role checks, profile synchronization and validation, duplicate phones, address/default lifecycle, FE CRUD/error handling and checkout integration.
