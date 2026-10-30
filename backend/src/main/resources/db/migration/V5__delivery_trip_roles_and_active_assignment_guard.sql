INSERT INTO roles (code, name)
VALUES ('DELIVERY_STAFF', 'Delivery Staff')
ON CONFLICT (code) DO NOTHING;

-- The application also locks the order before assigning it. This constraint is the
-- final guard against concurrent requests assigning an order to two active trips.
CREATE UNIQUE INDEX uq_delivery_assignments_active_order
    ON delivery_assignments(order_id)
    WHERE active = TRUE;
