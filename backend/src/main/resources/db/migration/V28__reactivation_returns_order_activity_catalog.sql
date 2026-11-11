-- Loại nước và dung tích để lọc danh mục. NULL nghĩa là chưa phân loại / chưa nhập dung tích.
ALTER TABLE products
    ADD COLUMN water_type VARCHAR(30),
    ADD COLUMN volume_ml INTEGER,
    ADD CONSTRAINT chk_products_water_type CHECK (water_type IS NULL OR water_type IN
        ('PURIFIED', 'MINERAL', 'ALKALINE', 'REMINERALIZED', 'SPARKLING', 'ELECTROLYTE', 'CONTAINER')),
    ADD CONSTRAINT chk_products_volume_ml CHECK (volume_ml IS NULL OR volume_ml BETWEEN 1 AND 100000);

-- Nhật ký theo đơn: gắn mỗi dòng nhật ký với đơn liên quan (đơn, xuất kho, chuyến giao, hàng hoàn, trả hàng).
ALTER TABLE audit_logs ADD COLUMN order_id BIGINT;
UPDATE audit_logs SET order_id = entity_id WHERE entity_type = 'ORDER' AND entity_id IS NOT NULL;
UPDATE audit_logs a SET order_id = d.order_id FROM order_dispatches d
    WHERE a.entity_type = 'DISPATCH' AND d.id = a.entity_id AND a.order_id IS NULL;
UPDATE audit_logs a SET order_id = r.order_id FROM inventory_returns r
    WHERE a.entity_type = 'INVENTORY_RETURN' AND r.id = a.entity_id AND a.order_id IS NULL;
-- Kết quả giao hàng cũ chỉ ghi số đơn trong mô tả ("· đơn #12 · DELIVERED").
UPDATE audit_logs a SET order_id = CAST(substring(a.reason FROM '· đơn #([0-9]+)') AS BIGINT)
    WHERE a.entity_type = 'DELIVERY_TRIP' AND a.action = 'recordResult' AND a.order_id IS NULL
      AND a.reason ~ '· đơn #[0-9]+'
      AND EXISTS (SELECT 1 FROM orders o WHERE o.id = CAST(substring(a.reason FROM '· đơn #([0-9]+)') AS BIGINT));
CREATE INDEX idx_audit_logs_order ON audit_logs(order_id, created_at, id) WHERE order_id IS NOT NULL;

-- Trả hàng sau giao: chống gửi trùng và liên kết phiếu hoàn tiền tạo cùng lúc.
ALTER TABLE order_returns
    ADD COLUMN request_id UUID,
    ADD COLUMN request_hash VARCHAR(64),
    ADD COLUMN payment_id BIGINT REFERENCES payments(id);
CREATE UNIQUE INDEX uq_order_returns_request ON order_returns(request_id) WHERE request_id IS NOT NULL;
-- Lô nhận lại khi nhập lại kho, để không nhập lại một lô quá số khách đã nhận từ lô đó.
CREATE TABLE order_return_batches (
    id BIGSERIAL PRIMARY KEY,
    return_id BIGINT NOT NULL REFERENCES order_returns(id),
    order_item_id BIGINT NOT NULL REFERENCES order_items(id),
    batch_id BIGINT NOT NULL REFERENCES product_batches(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    UNIQUE (return_id, order_item_id, batch_id)
);
CREATE INDEX idx_order_return_batches_item ON order_return_batches(order_item_id, batch_id);

-- Giá trị hàng khách đã trả, chia theo tỷ lệ giảm giá của đơn (cùng cách tính với báo cáo doanh thu).
CREATE VIEW order_returned_values AS
SELECT r.order_id,
       ROUND(SUM(ri.quantity * oi.unit_price *
           CASE WHEN o.subtotal > 0 THEN (o.subtotal - o.discount_amount) / o.subtotal ELSE 1 END), 2) AS returned
FROM order_returns r
JOIN order_return_items ri ON ri.return_id = r.id
JOIN order_items oi ON oi.id = ri.order_item_id
JOIN orders o ON o.id = r.order_id
GROUP BY r.order_id;

-- Tổng phải trả của đơn trừ phần đã trả lại; thu dư sau trả hàng thành số phải hoàn. Cột mới `returned` ở cuối.
CREATE OR REPLACE VIEW order_payment_balances AS
SELECT o.id AS order_id, o.order_code, o.customer_id, o.status,
       GREATEST(o.subtotal-o.discount_amount+o.delivery_fee-COALESCE(rv.returned,0),0) AS total,
       COALESCE(p.received,0) AS received, COALESCE(p.refunded,0) AS refunded,
       COALESCE(p.received,0)-COALESCE(p.refunded,0) AS paid,
       CASE WHEN o.status='CANCELLED' THEN 0
            ELSE GREATEST(GREATEST(o.subtotal-o.discount_amount+o.delivery_fee-COALESCE(rv.returned,0),0)
                          -COALESCE(p.received,0)+COALESCE(p.refunded,0),0) END AS due,
       CASE WHEN o.status='CANCELLED' THEN GREATEST(COALESCE(p.received,0)-COALESCE(p.refunded,0),0)
            ELSE GREATEST(COALESCE(p.received,0)-COALESCE(p.refunded,0)
                          -GREATEST(o.subtotal-o.discount_amount+o.delivery_fee-COALESCE(rv.returned,0),0),0) END AS refund_due,
       COALESCE(rv.returned,0) AS returned
FROM orders o LEFT JOIN (
    SELECT p.order_id,
           SUM(CASE WHEN p.direction='IN' THEN a.amount ELSE 0 END) AS received,
           SUM(CASE WHEN p.direction='OUT' THEN a.amount ELSE 0 END) AS refunded
    FROM payments p JOIN payment_allocations a ON a.payment_id=p.id AND a.allocation_type='SALE'
    WHERE p.status='CONFIRMED' GROUP BY p.order_id
) p ON p.order_id=o.id
LEFT JOIN order_returned_values rv ON rv.order_id=o.id;

CREATE OR REPLACE FUNCTION refresh_order_payment_status(target_id BIGINT) RETURNS void AS $$
BEGIN
    UPDATE orders o SET payment_status = CASE
        WHEN b.status='CANCELLED' AND b.paid>0 THEN 'REFUND_PENDING'
        WHEN b.status='CANCELLED' AND b.received>0 THEN 'REFUNDED'
        WHEN b.status='CANCELLED' THEN 'UNPAID'
        WHEN b.refund_due>0 THEN 'REFUND_PENDING'
        -- Trả hết hàng trước khi trả tiền: không còn gì phải thu.
        WHEN b.due=0 AND (b.received>0 OR b.returned>0) THEN 'PAID'
        WHEN b.paid>0 THEN 'PARTIALLY_PAID'
        ELSE 'UNPAID' END
    FROM order_payment_balances b WHERE o.id=target_id AND b.order_id=o.id;
END;
$$ LANGUAGE plpgsql;

-- Đơn đã có phiếu trả từ trước (nếu có) tính lại trạng thái thanh toán theo số dư mới.
SELECT refresh_order_payment_status(order_id) FROM order_returned_values;
