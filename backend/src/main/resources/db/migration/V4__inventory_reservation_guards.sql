-- Không cho giữ hàng vượt tồn thực tế của lô (lớp chặn cuối ở DB)
ALTER TABLE inventory_balances
    ADD CONSTRAINT chk_inventory_balances_reserved_le_on_hand CHECK (reserved <= on_hand);

-- Phục vụ truy vấn FEFO: lô của sản phẩm sắp theo hạn sử dụng
CREATE INDEX idx_product_batches_product_expires ON product_batches(product_id, expires_on);
