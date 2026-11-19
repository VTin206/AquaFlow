-- Khách chọn khung giờ giao (Sáng 8-11, Trưa 11-14, ...): requested_delivery_at là đầu khung, requested_delivery_until là cuối khung.
-- Đơn cũ và đơn hẹn một mốc giờ để NULL; khi đó giờ hẹn vẫn là requested_delivery_at như trước.
ALTER TABLE orders ADD COLUMN requested_delivery_until TIMESTAMPTZ;

ALTER TABLE orders ADD CONSTRAINT chk_orders_delivery_window CHECK (
    requested_delivery_until IS NULL
    OR (requested_delivery_at IS NOT NULL
        AND requested_delivery_until > requested_delivery_at
        AND requested_delivery_until <= requested_delivery_at + INTERVAL '12 hours')
);
