CREATE TABLE delivery_bottle_manifests (
    assignment_id BIGINT PRIMARY KEY REFERENCES delivery_assignments(id),
    customer_id BIGINT REFERENCES customers(id),
    given BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE delivery_bottle_lines (
    assignment_id BIGINT NOT NULL REFERENCES delivery_bottle_manifests(assignment_id),
    bottle_type_id BIGINT NOT NULL REFERENCES bottle_types(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_deposit NUMERIC(14,2) NOT NULL CHECK (unit_deposit >= 0),
    PRIMARY KEY (assignment_id,bottle_type_id)
);
CREATE TABLE delivery_bottle_return_requests (
    id UUID PRIMARY KEY,
    assignment_id BIGINT NOT NULL REFERENCES delivery_bottle_manifests(assignment_id),
    actor_id BIGINT NOT NULL REFERENCES users(id),
    payload TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE delivery_bottle_return_lines (
    request_id UUID NOT NULL REFERENCES delivery_bottle_return_requests(id),
    bottle_type_id BIGINT NOT NULL REFERENCES bottle_types(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    PRIMARY KEY(request_id,bottle_type_id)
);
CREATE INDEX idx_delivery_bottle_returns_assignment ON delivery_bottle_return_requests(assignment_id);
