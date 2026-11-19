# Customer registration and login

- Public `POST /api/v1/auth/register` accepts `fullName`, `email`, `phone`, `password` and optional `verificationCode`, and returns HTTP 201 with the user profile (no password or token).
- The server always creates an ACTIVE CUSTOMER, regardless of client-supplied role/status. User and customer profile are saved in one transaction. V19 provisions the CUSTOMER role idempotently.
- Email is trimmed and normalized to lowercase; passwords are hashed and limited to 8–128 characters and 72 UTF-8 bytes. Phone accepts local/Vietnam international notation and is normalized to local notation.
- Existing email/active customer phone returns 409. Registration never claims an existing customer profile or its orders just by matching phone. Existing customers must contact the store for account linking; no self-service linking or phone verification is implemented here.
- `/shop/register` and `/register` now submit real registration requests, validate confirmation/terms, show loading/errors, and offer a login link after success. `/shop/account` and `/login` use the existing login API; CUSTOMER lands at `/shop/orders` and cannot enter staff management.
- Registration does not automatically authenticate. Login returns the existing JWT session. Existing staff login is unchanged.
## Email verification (V36)

Off by default. Set `REGISTRATION_VERIFY_EMAIL=true` with Gmail SMTP configured (step-by-step: [EMAIL_SETUP.md](EMAIL_SETUP.md)). When off, registration works as before without a code.

- `POST /api/v1/auth/register/verification-codes` with `{ "email", "phone" }`: checks email and phone are free (409 otherwise, before any mail), then mails a 6-digit code. Returns 202 `{ "required": true, "expiresInSeconds": 600, "resendAfterSeconds": 60 }`, or `{ "required": false }` when verification is off. 429 with `retryAfterSeconds` if a code for this email was sent less than 60 s ago (that code stays valid); 429 after 10 requests per IP in 15 minutes; 503 if SMTP fails (the new code is rolled back).
- `POST /api/v1/auth/register` then needs `verificationCode` (6 digits). Missing, wrong, expired (10 minutes) or locked codes return 400 with a Vietnamese message. Each wrong code is counted; after 5 the code is locked and the customer must request a new one. A new code resets the count and invalidates the old code. A successful registration deletes the code.
- V36 `registration_verifications` keeps one row per lowercase email with a BCrypt hash of the code, attempt count, send time and expiry. The plain code is never stored or logged. Rows expired for over a day are purged when a new code is sent.
- UI: "Tạo tài khoản" requests the code and opens the "Xác nhận email" window (6-digit input, auto-submits when complete, "Gửi lại mã" after 60 s, clears the input after a wrong code). Closing the window keeps the form; submitting again within 60 s reuses the code already sent.
- Tests: `RegistrationVerificationIntegrationTest` (required code, single use, hashed storage, 5-attempt lock, resend wait, expiry, duplicate email before mail, SMTP failure rollback, verification off) and `RegisterForm.test.tsx`.

- Tests: `CustomerRegistrationIntegrationTest` uses an isolated PostgreSQL database and verifies role injection, password hashing, profile ownership, staff-route denial, duplicates and invalid requests. `RegisterForm.test.tsx` verifies success, recoverable error and password mismatch.
