ALTER TABLE customers
    ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX uq_customer_addresses_one_default_per_customer
    ON customer_addresses (customer_id)
    WHERE is_default = TRUE;
