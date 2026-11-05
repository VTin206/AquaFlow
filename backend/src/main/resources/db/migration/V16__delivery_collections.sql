CREATE TABLE delivery_collections (
    id BIGSERIAL PRIMARY KEY,
    assignment_id BIGINT NOT NULL REFERENCES delivery_assignments(id),
    payment_id BIGINT UNIQUE REFERENCES payments(id),
    request_id UUID NOT NULL UNIQUE,
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    method VARCHAR(20) NOT NULL CHECK (method IN ('CASH', 'BANK_TRANSFER')),
    bottles_returned INTEGER NOT NULL CHECK (bottles_returned >= 0),
    recorded_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (amount > 0 OR bottles_returned > 0)
);
CREATE INDEX idx_delivery_collections_assignment ON delivery_collections(assignment_id);
