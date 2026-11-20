-- Cách khách chọn trả tiền khi đặt đơn web: COD (trả khi nhận hàng) hoặc TRANSFER (chuyển khoản trước theo mã QR).
-- Đơn cũ và đơn tạo tại quầy để NULL; không suy ngược từ ghi chú đơn.
ALTER TABLE orders ADD COLUMN payment_method VARCHAR(16);

ALTER TABLE orders ADD CONSTRAINT chk_orders_payment_method CHECK (
    payment_method IS NULL OR payment_method IN ('COD', 'TRANSFER')
);
