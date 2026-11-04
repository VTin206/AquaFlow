CREATE INDEX idx_orders_delivered_at ON orders(delivered_at) WHERE delivered_at IS NOT NULL;
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_delivery_attempts_time ON delivery_attempts(attempted_at);
CREATE INDEX idx_payments_confirmed_time ON payments(confirmed_at) WHERE status='CONFIRMED';
CREATE INDEX idx_order_returns_time ON order_returns(created_at);
