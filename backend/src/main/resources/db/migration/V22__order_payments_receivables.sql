ALTER TABLE payments ADD COLUMN request_id UUID;
ALTER TABLE payments ADD COLUMN note VARCHAR(200);
CREATE UNIQUE INDEX uq_payments_request_id ON payments(request_id) WHERE request_id IS NOT NULL;

-- One source of truth shared with delivery collections. Deposits are excluded.
CREATE VIEW order_payment_balances AS
SELECT o.id AS order_id, o.order_code, o.customer_id, o.status,
       o.subtotal-o.discount_amount+o.delivery_fee AS total,
       COALESCE(p.received,0) AS received, COALESCE(p.refunded,0) AS refunded,
       COALESCE(p.received,0)-COALESCE(p.refunded,0) AS paid,
       CASE WHEN o.status='CANCELLED' THEN 0 ELSE GREATEST(o.subtotal-o.discount_amount+o.delivery_fee-COALESCE(p.received,0)+COALESCE(p.refunded,0),0) END AS due,
       CASE WHEN o.status='CANCELLED' THEN GREATEST(COALESCE(p.received,0)-COALESCE(p.refunded,0),0) ELSE 0 END AS refund_due
FROM orders o LEFT JOIN (
    SELECT p.order_id,
           SUM(CASE WHEN p.direction='IN' THEN a.amount ELSE 0 END) AS received,
           SUM(CASE WHEN p.direction='OUT' THEN a.amount ELSE 0 END) AS refunded
    FROM payments p JOIN payment_allocations a ON a.payment_id=p.id AND a.allocation_type='SALE'
    WHERE p.status='CONFIRMED' GROUP BY p.order_id
) p ON p.order_id=o.id;

CREATE FUNCTION refresh_order_payment_status(target_id BIGINT) RETURNS void AS $$
BEGIN
    UPDATE orders o SET payment_status = CASE
        WHEN b.status='CANCELLED' AND b.paid>0 THEN 'REFUND_PENDING'
        WHEN b.status='CANCELLED' AND b.received>0 THEN 'REFUNDED'
        WHEN b.status='CANCELLED' THEN 'UNPAID'
        WHEN b.due=0 AND b.received>0 THEN 'PAID'
        WHEN b.paid>0 THEN 'PARTIALLY_PAID'
        ELSE 'UNPAID' END
    FROM order_payment_balances b WHERE o.id=target_id AND b.order_id=o.id;
END;
$$ LANGUAGE plpgsql;

-- Cancellation/return/redelivery can change status outside the sales controller.
CREATE FUNCTION order_status_refresh_payment() RETURNS trigger AS $$
BEGIN
    PERFORM refresh_order_payment_status(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER order_status_refresh_payment AFTER UPDATE OF status,subtotal,discount_amount,delivery_fee ON orders
FOR EACH ROW EXECUTE FUNCTION order_status_refresh_payment();

SELECT refresh_order_payment_status(id) FROM orders;
