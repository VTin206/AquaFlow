CREATE TABLE bottle_ledger_requests (
    id UUID PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    actor_id BIGINT NOT NULL REFERENCES users(id),
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('GIVE','RECEIVE','LOSS','COLLECT','REFUND')),
    bottle_type_id BIGINT REFERENCES bottle_types(id),
    quantity INTEGER,
    amount NUMERIC(14,2),
    note VARCHAR(300),
    bottles_delta INTEGER NOT NULL,
    deposit_delta NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bottle_ledger_requests_customer ON bottle_ledger_requests(customer_id);
ALTER TABLE bottle_transactions ADD COLUMN ledger_request_id UUID REFERENCES bottle_ledger_requests(id),
    ADD COLUMN liability_delta NUMERIC(14,2) NOT NULL DEFAULT 0;
-- Preserve the opening obligation of existing records using the rate available at migration.
UPDATE bottle_transactions t SET liability_delta = t.quantity * b.deposit_unit_amount *
    CASE WHEN t.movement IN ('GIVE','ADJUST_GIVE') THEN 1 ELSE -1 END
    FROM bottle_types b WHERE b.id=t.bottle_type_id;
ALTER TABLE deposit_transactions ADD COLUMN ledger_request_id UUID REFERENCES bottle_ledger_requests(id);
