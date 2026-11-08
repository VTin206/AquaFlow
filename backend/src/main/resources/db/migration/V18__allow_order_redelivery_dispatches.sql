ALTER TABLE order_dispatches
    DROP CONSTRAINT IF EXISTS order_dispatches_order_id_key;

ALTER TABLE inventory_returns
    DROP CONSTRAINT IF EXISTS inventory_returns_order_id_key;

CREATE INDEX idx_order_dispatches_order_id_dispatched_at
    ON order_dispatches(order_id, dispatched_at DESC, id DESC);

CREATE INDEX idx_inventory_returns_order_id_created_at
    ON inventory_returns(order_id, created_at DESC, id DESC);
