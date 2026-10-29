-- Persistent fields used by the complete administration UI.
ALTER TABLE products ADD COLUMN image_url TEXT,
    ADD COLUMN catalog JSONB,
    ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0);
ALTER TABLE suppliers ADD COLUMN contact_name VARCHAR(150), ADD COLUMN email VARCHAR(254);
ALTER TABLE customers ADD COLUMN customer_type VARCHAR(20) NOT NULL DEFAULT 'Cá nhân',
    ADD COLUMN area VARCHAR(150), ADD COLUMN note TEXT;
ALTER TABLE orders ADD COLUMN delivery_floor INTEGER NOT NULL DEFAULT 0 CHECK (delivery_floor BETWEEN 0 AND 30),
    ADD COLUMN delivery_failed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN delivered_at TIMESTAMPTZ,
    ADD COLUMN tracking_token VARCHAR(64) UNIQUE;
ALTER TABLE purchase_receipts ADD COLUMN receiver_name VARCHAR(150);
ALTER TABLE delivery_trips ADD COLUMN driver_name VARCHAR(150), ADD COLUMN vehicle VARCHAR(40);
ALTER TABLE delivery_trips ALTER COLUMN driver_id DROP NOT NULL;
ALTER TABLE handover_records ALTER COLUMN driver_id DROP NOT NULL;
CREATE UNIQUE INDEX uq_delivery_assignments_active_order ON delivery_assignments(order_id) WHERE active;
ALTER TABLE handover_records ADD COLUMN bottles_expected INTEGER NOT NULL DEFAULT 0 CHECK (bottles_expected >= 0),
    ADD COLUMN bottles_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (bottles_confirmed >= 0);
CREATE UNIQUE INDEX uq_handover_trip ON handover_records(trip_id);
CREATE UNIQUE INDEX uq_confirmed_payment_reference ON payments(external_reference)
    WHERE external_reference IS NOT NULL AND status = 'CONFIRMED';
ALTER TABLE bottle_transactions ADD COLUMN entry_kind VARCHAR(50);
ALTER TABLE deposit_transactions ADD COLUMN entry_kind VARCHAR(50), ADD COLUMN note TEXT;
CREATE TABLE order_returns (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    reason TEXT NOT NULL,
    restocked BOOLEAN NOT NULL,
    refunded NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (refunded >= 0),
    performed_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE order_return_items (
    id BIGSERIAL PRIMARY KEY,
    return_id BIGINT NOT NULL REFERENCES order_returns(id),
    order_item_id BIGINT NOT NULL REFERENCES order_items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    UNIQUE(return_id, order_item_id)
);
CREATE INDEX idx_order_returns_order ON order_returns(order_id);
CREATE TABLE store_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    settings JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by BIGINT REFERENCES users(id)
);
INSERT INTO store_settings(id, settings) VALUES (1,
    '{"storeName":"AquaFlow","address":"","phone":"","expiryWarningDays":30,"defaultLowStock":10}');
CREATE TABLE workspace_requests (
    request_id UUID PRIMARY KEY,
    actor_id BIGINT NOT NULL REFERENCES users(id),
    signature TEXT NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
