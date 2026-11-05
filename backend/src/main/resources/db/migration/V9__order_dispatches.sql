CREATE TABLE order_dispatches (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id),
    performed_by BIGINT NOT NULL REFERENCES users(id),
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    order_status VARCHAR(32) NOT NULL CHECK (order_status IN ('OUT_FOR_DELIVERY', 'DELIVERED'))
);

CREATE TABLE order_dispatch_items (
    id BIGSERIAL PRIMARY KEY,
    dispatch_id BIGINT NOT NULL REFERENCES order_dispatches(id),
    order_item_id BIGINT NOT NULL REFERENCES order_items(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    batch_id BIGINT NOT NULL REFERENCES product_batches(id),
    lot_code VARCHAR(100) NOT NULL,
    expires_on DATE NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    UNIQUE (dispatch_id, order_item_id, batch_id)
);
