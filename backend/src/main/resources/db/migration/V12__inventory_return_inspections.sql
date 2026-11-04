CREATE TABLE inventory_returns (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id),
    assignment_id BIGINT NOT NULL UNIQUE REFERENCES delivery_assignments(id),
    performed_by BIGINT NOT NULL REFERENCES users(id),
    note VARCHAR(300),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE inventory_return_lines (
    id BIGSERIAL PRIMARY KEY,
    return_id BIGINT NOT NULL REFERENCES inventory_returns(id),
    load_item_id BIGINT NOT NULL UNIQUE REFERENCES delivery_load_items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    sellable INTEGER NOT NULL CHECK (sellable >= 0 AND sellable <= quantity)
);
