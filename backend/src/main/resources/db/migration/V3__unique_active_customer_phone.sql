-- V1/V2 remain unchanged. Existing duplicate active phones must be resolved before upgrade.
UPDATE customers
SET phone = '0' || SUBSTRING(phone FROM 4)
WHERE phone LIKE '+84%';

CREATE UNIQUE INDEX uq_customers_active_phone
    ON customers (phone)
    WHERE active = TRUE AND phone IS NOT NULL;
