CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES roles(id),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE,
    phone VARCHAR(20),
    password_hash TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE customers (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES users(id),
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customer_addresses (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    recipient_name VARCHAR(150) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    address_line TEXT NOT NULL,
    area VARCHAR(150),
    is_default BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE suppliers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE bottle_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    deposit_unit_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_bottle_types_deposit_unit_amount CHECK (deposit_unit_amount >= 0)
);

CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    sku VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    brand VARCHAR(150),
    unit VARCHAR(40) NOT NULL,
    units_per_case INTEGER,
    bottle_type_id BIGINT REFERENCES bottle_types(id),
    sale_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_products_units_per_case CHECK (units_per_case IS NULL OR units_per_case > 0),
    CONSTRAINT chk_products_sale_price CHECK (sale_price >= 0)
);

CREATE TABLE purchase_receipts (
    id BIGSERIAL PRIMARY KEY,
    supplier_id BIGINT NOT NULL REFERENCES suppliers(id),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    received_at TIMESTAMPTZ,
    created_by BIGINT NOT NULL REFERENCES users(id),
    confirmed_by BIGINT REFERENCES users(id),
    confirmed_at TIMESTAMPTZ,
    note TEXT,
    CONSTRAINT chk_purchase_receipts_status CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED'))
);

CREATE TABLE product_batches (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    lot_code VARCHAR(100) NOT NULL,
    manufactured_on DATE,
    expires_on DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_batches_product_lot UNIQUE (product_id, lot_code),
    CONSTRAINT chk_product_batches_dates CHECK (manufactured_on IS NULL OR manufactured_on <= expires_on)
);

CREATE TABLE purchase_items (
    id BIGSERIAL PRIMARY KEY,
    receipt_id BIGINT NOT NULL REFERENCES purchase_receipts(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    batch_id BIGINT REFERENCES product_batches(id),
    quantity_received INTEGER NOT NULL,
    quantity_accepted INTEGER NOT NULL,
    unit_cost NUMERIC(14, 2) NOT NULL,
    CONSTRAINT chk_purchase_items_quantities CHECK (
        quantity_received > 0
        AND quantity_accepted >= 0
        AND quantity_accepted <= quantity_received
    ),
    CONSTRAINT chk_purchase_items_unit_cost CHECK (unit_cost >= 0)
);

CREATE TABLE inventory_balances (
    batch_id BIGINT PRIMARY KEY REFERENCES product_batches(id),
    on_hand INTEGER NOT NULL DEFAULT 0,
    reserved INTEGER NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_inventory_balances_on_hand CHECK (on_hand >= 0),
    CONSTRAINT chk_inventory_balances_reserved CHECK (reserved >= 0),
    CONSTRAINT chk_inventory_balances_version CHECK (version >= 0)
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    order_code VARCHAR(50) NOT NULL UNIQUE,
    customer_id BIGINT REFERENCES customers(id),
    created_by BIGINT REFERENCES users(id),
    channel VARCHAR(20) NOT NULL,
    fulfillment_type VARCHAR(20) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
    recipient_name VARCHAR(150),
    recipient_phone VARCHAR(20),
    delivery_address TEXT,
    delivery_area VARCHAR(150),
    requested_delivery_at TIMESTAMPTZ,
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    delivery_fee NUMERIC(14, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    note TEXT,
    CONSTRAINT chk_orders_channel CHECK (channel IN ('WEB', 'COUNTER', 'PHONE', 'MESSAGE')),
    CONSTRAINT chk_orders_fulfillment_type CHECK (fulfillment_type IN ('COUNTER', 'DELIVERY')),
    CONSTRAINT chk_orders_status CHECK (
        status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED')
    ),
    CONSTRAINT chk_orders_payment_status CHECK (
        payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUND_PENDING', 'REFUNDED')
    ),
    CONSTRAINT chk_orders_amounts CHECK (subtotal >= 0 AND discount_amount >= 0 AND delivery_fee >= 0)
);

CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(14, 2) NOT NULL,
    line_total NUMERIC(14, 2) NOT NULL,
    CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_order_items_amounts CHECK (unit_price >= 0 AND line_total >= 0)
);

CREATE TABLE stock_reservations (
    id BIGSERIAL PRIMARY KEY,
    order_item_id BIGINT NOT NULL REFERENCES order_items(id),
    batch_id BIGINT NOT NULL REFERENCES product_batches(id),
    quantity_reserved INTEGER NOT NULL,
    quantity_dispatched INTEGER NOT NULL DEFAULT 0,
    quantity_released INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_stock_reservations_item_batch UNIQUE (order_item_id, batch_id),
    CONSTRAINT chk_stock_reservations_quantities CHECK (
        quantity_reserved > 0
        AND quantity_dispatched >= 0
        AND quantity_released >= 0
        AND quantity_dispatched + quantity_released <= quantity_reserved
    )
);

CREATE TABLE delivery_trips (
    id BIGSERIAL PRIMARY KEY,
    driver_id BIGINT NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'CREATED',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_delivery_trips_status CHECK (status IN ('CREATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

CREATE TABLE delivery_assignments (
    id BIGSERIAL PRIMARY KEY,
    trip_id BIGINT NOT NULL REFERENCES delivery_trips(id),
    order_id BIGINT NOT NULL REFERENCES orders(id),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_delivery_assignments_trip_order UNIQUE (trip_id, order_id)
);

CREATE TABLE delivery_attempts (
    id BIGSERIAL PRIMARY KEY,
    assignment_id BIGINT NOT NULL REFERENCES delivery_assignments(id),
    attempt_no INTEGER NOT NULL,
    outcome VARCHAR(20) NOT NULL,
    recipient_name VARCHAR(150),
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    failure_reason TEXT,
    note TEXT,
    CONSTRAINT uq_delivery_attempts_assignment_no UNIQUE (assignment_id, attempt_no),
    CONSTRAINT chk_delivery_attempts_attempt_no CHECK (attempt_no > 0),
    CONSTRAINT chk_delivery_attempts_outcome CHECK (outcome IN ('SUCCESS', 'FAILED'))
);

CREATE TABLE delivery_load_items (
    id BIGSERIAL PRIMARY KEY,
    assignment_id BIGINT NOT NULL REFERENCES delivery_assignments(id),
    order_item_id BIGINT NOT NULL REFERENCES order_items(id),
    batch_id BIGINT NOT NULL REFERENCES product_batches(id),
    quantity_loaded INTEGER NOT NULL,
    quantity_delivered INTEGER NOT NULL DEFAULT 0,
    quantity_returned INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT chk_delivery_load_items_quantities CHECK (
        quantity_loaded > 0
        AND quantity_delivered >= 0
        AND quantity_returned >= 0
        AND quantity_delivered + quantity_returned <= quantity_loaded
    )
);

CREATE TABLE inventory_movements (
    id BIGSERIAL PRIMARY KEY,
    batch_id BIGINT NOT NULL REFERENCES product_batches(id),
    movement_type VARCHAR(30) NOT NULL,
    quantity INTEGER NOT NULL,
    reference_type VARCHAR(30) NOT NULL,
    reference_id BIGINT NOT NULL,
    reason TEXT,
    performed_by BIGINT NOT NULL REFERENCES users(id),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_inventory_movements_type CHECK (
        movement_type IN ('RECEIVE', 'COUNTER_SALE', 'DISPATCH', 'RETURN', 'ADJUST_UP', 'ADJUST_DOWN')
    ),
    CONSTRAINT chk_inventory_movements_quantity CHECK (quantity > 0),
    CONSTRAINT chk_inventory_movements_reference_id CHECK (reference_id > 0)
);

CREATE TABLE handover_records (
    id BIGSERIAL PRIMARY KEY,
    trip_id BIGINT NOT NULL REFERENCES delivery_trips(id),
    driver_id BIGINT NOT NULL REFERENCES users(id),
    received_by BIGINT NOT NULL REFERENCES users(id),
    cash_reported NUMERIC(14, 2) NOT NULL DEFAULT 0,
    cash_confirmed NUMERIC(14, 2) NOT NULL DEFAULT 0,
    note TEXT,
    handed_over_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_handover_records_cash CHECK (cash_reported >= 0 AND cash_confirmed >= 0)
);

CREATE TABLE bottle_transactions (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    bottle_type_id BIGINT NOT NULL REFERENCES bottle_types(id),
    order_id BIGINT REFERENCES orders(id),
    delivery_attempt_id BIGINT REFERENCES delivery_attempts(id),
    movement VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL,
    condition_note TEXT,
    performed_by BIGINT NOT NULL REFERENCES users(id),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_bottle_transactions_movement CHECK (movement IN ('GIVE', 'RECEIVE', 'ADJUST_GIVE', 'ADJUST_RECEIVE')),
    CONSTRAINT chk_bottle_transactions_quantity CHECK (quantity > 0)
);

CREATE TABLE deposit_transactions (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    order_id BIGINT REFERENCES orders(id),
    bottle_transaction_id BIGINT REFERENCES bottle_transactions(id),
    direction VARCHAR(20) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_deposit_transactions_direction CHECK (direction IN ('COLLECT', 'REFUND', 'ADJUST_COLLECT', 'ADJUST_REFUND')),
    CONSTRAINT chk_deposit_transactions_amount CHECK (amount > 0)
);

CREATE TABLE qr_payment_requests (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    requested_amount NUMERIC(14, 2) NOT NULL,
    transfer_content VARCHAR(200) NOT NULL,
    payee_bank_name VARCHAR(150),
    payee_account_snapshot VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_qr_payment_requests_amount CHECK (requested_amount > 0),
    CONSTRAINT chk_qr_payment_requests_status CHECK (status IN ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED'))
);

CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    qr_request_id BIGINT REFERENCES qr_payment_requests(id),
    direction VARCHAR(10) NOT NULL,
    method VARCHAR(20) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    external_reference VARCHAR(200),
    confirmed_by BIGINT REFERENCES users(id),
    confirmed_at TIMESTAMPTZ,
    recorded_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_payments_direction CHECK (direction IN ('IN', 'OUT')),
    CONSTRAINT chk_payments_method CHECK (method IN ('CASH', 'BANK_TRANSFER')),
    CONSTRAINT chk_payments_amount CHECK (amount > 0),
    CONSTRAINT chk_payments_status CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED'))
);

CREATE TABLE payment_allocations (
    id BIGSERIAL PRIMARY KEY,
    payment_id BIGINT NOT NULL REFERENCES payments(id),
    allocation_type VARCHAR(20) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    CONSTRAINT chk_payment_allocations_type CHECK (allocation_type IN ('SALE', 'DEPOSIT')),
    CONSTRAINT chk_payment_allocations_amount CHECK (amount > 0)
);

CREATE TABLE incident_reports (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id),
    trip_id BIGINT REFERENCES delivery_trips(id),
    incident_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    resolution TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_incident_reports_status CHECK (status IN ('OPEN', 'RESOLVED'))
);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id BIGINT REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id BIGINT,
    before_json JSONB,
    after_json JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_status_history (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    from_status VARCHAR(32),
    to_status VARCHAR(32) NOT NULL,
    changed_by BIGINT REFERENCES users(id),
    reason TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_order_status_history_to_status CHECK (
        to_status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED')
    )
);

CREATE TABLE order_expected_bottle_returns (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    bottle_type_id BIGINT NOT NULL REFERENCES bottle_types(id),
    expected_quantity INTEGER NOT NULL,
    CONSTRAINT uq_order_expected_bottle_returns_order_type UNIQUE (order_id, bottle_type_id),
    CONSTRAINT chk_order_expected_bottle_returns_quantity CHECK (expected_quantity > 0)
);

CREATE TABLE order_tracking_tokens (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE supplier_bottle_exchanges (
    id BIGSERIAL PRIMARY KEY,
    receipt_id BIGINT NOT NULL REFERENCES purchase_receipts(id),
    bottle_type_id BIGINT NOT NULL REFERENCES bottle_types(id),
    movement VARCHAR(12) NOT NULL,
    quantity INTEGER NOT NULL,
    CONSTRAINT chk_supplier_bottle_exchanges_movement CHECK (movement IN ('GIVE', 'RECEIVE')),
    CONSTRAINT chk_supplier_bottle_exchanges_quantity CHECK (quantity > 0)
);

CREATE TABLE supplier_payments (
    id BIGSERIAL PRIMARY KEY,
    receipt_id BIGINT NOT NULL REFERENCES purchase_receipts(id),
    method VARCHAR(20) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by BIGINT NOT NULL REFERENCES users(id),
    CONSTRAINT chk_supplier_payments_method CHECK (method IN ('CASH', 'BANK_TRANSFER')),
    CONSTRAINT chk_supplier_payments_amount CHECK (amount > 0)
);

CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_customer_addresses_customer_id ON customer_addresses(customer_id);
CREATE INDEX idx_products_bottle_type_id ON products(bottle_type_id);
CREATE INDEX idx_purchase_receipts_supplier_id ON purchase_receipts(supplier_id);
CREATE INDEX idx_purchase_receipts_status ON purchase_receipts(status);
CREATE INDEX idx_purchase_items_receipt_id ON purchase_items(receipt_id);
CREATE INDEX idx_purchase_items_product_id ON purchase_items(product_id);
CREATE INDEX idx_purchase_items_batch_id ON purchase_items(batch_id);
CREATE INDEX idx_product_batches_product_id ON product_batches(product_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_stock_reservations_batch_id ON stock_reservations(batch_id);
CREATE INDEX idx_delivery_assignments_order_id ON delivery_assignments(order_id);
CREATE INDEX idx_delivery_attempts_assignment_id ON delivery_attempts(assignment_id);
CREATE INDEX idx_delivery_load_items_assignment_id ON delivery_load_items(assignment_id);
CREATE INDEX idx_delivery_load_items_order_item_id ON delivery_load_items(order_item_id);
CREATE INDEX idx_inventory_movements_batch_id ON inventory_movements(batch_id);
CREATE INDEX idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id);
CREATE INDEX idx_bottle_transactions_customer_id ON bottle_transactions(customer_id);
CREATE INDEX idx_bottle_transactions_order_id ON bottle_transactions(order_id);
CREATE INDEX idx_deposit_transactions_customer_id ON deposit_transactions(customer_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payment_allocations_payment_id ON payment_allocations(payment_id);
CREATE INDEX idx_incident_reports_order_id ON incident_reports(order_id);
CREATE INDEX idx_incident_reports_trip_id ON incident_reports(trip_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_order_tracking_tokens_order_id ON order_tracking_tokens(order_id);
CREATE INDEX idx_supplier_bottle_exchanges_receipt_id ON supplier_bottle_exchanges(receipt_id);
CREATE INDEX idx_supplier_payments_receipt_id ON supplier_payments(receipt_id);
