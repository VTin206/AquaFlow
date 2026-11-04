ALTER TABLE users ADD COLUMN credentials_version INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX uq_users_email_case_insensitive ON users (LOWER(email)) WHERE email IS NOT NULL;
INSERT INTO roles(code, name) VALUES ('SALES_STAFF', 'Sales staff'), ('DELIVERY_STAFF', 'Delivery staff')
ON CONFLICT (code) DO NOTHING;
