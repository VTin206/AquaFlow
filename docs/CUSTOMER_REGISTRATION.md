# Customer registration and login

- Public `POST /api/v1/auth/register` accepts `fullName`, `email`, `phone`, `password` and returns HTTP 201 with the user profile (no password or token).
- The server always creates an ACTIVE CUSTOMER, regardless of client-supplied role/status. User and customer profile are saved in one transaction. V19 provisions the CUSTOMER role idempotently.
- Email is trimmed and normalized to lowercase; passwords are hashed and limited to 8–128 characters and 72 UTF-8 bytes. Phone accepts local/Vietnam international notation and is normalized to local notation.
- Existing email/active customer phone returns 409. Registration never claims an existing customer profile or its orders just by matching phone. Existing customers must contact the store for account linking; no self-service linking or email/phone verification is implemented here.
- `/shop/register` and `/register` now submit real registration requests, validate confirmation/terms, show loading/errors, and offer a login link after success. `/shop/account` and `/login` use the existing login API; CUSTOMER lands at `/shop/orders` and cannot enter staff management.
- Registration does not automatically authenticate. Login returns the existing JWT session. Existing staff login is unchanged.
- Tests: `CustomerRegistrationIntegrationTest` uses an isolated PostgreSQL database and verifies role injection, password hashing, profile ownership, staff-route denial, duplicates and invalid requests. `RegisterForm.test.tsx` verifies success, recoverable error and password mismatch.
