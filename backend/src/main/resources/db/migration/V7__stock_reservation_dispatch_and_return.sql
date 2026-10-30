-- Ghi nhận hàng hoàn trên từng reservation đã xuất kho
ALTER TABLE stock_reservations
    ADD COLUMN quantity_returned INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN quantity_damaged INTEGER NOT NULL DEFAULT 0,
    ADD CONSTRAINT chk_stock_reservations_returns CHECK (
        quantity_returned >= 0
        AND quantity_damaged >= 0
        AND quantity_returned + quantity_damaged <= quantity_dispatched
    );

-- Giao lại có thể giữ lại đúng lô cũ cho cùng dòng đơn, nên bỏ ràng buộc một reservation mỗi lô
ALTER TABLE stock_reservations DROP CONSTRAINT uq_stock_reservations_item_batch;
CREATE INDEX idx_stock_reservations_order_item ON stock_reservations(order_item_id);
