-- Giao lại có thể giữ lại đúng lô cũ cho cùng dòng đơn, nên bỏ ràng buộc một reservation mỗi lô
ALTER TABLE stock_reservations DROP CONSTRAINT uq_stock_reservations_item_batch;
CREATE INDEX idx_stock_reservations_order_item ON stock_reservations(order_item_id);
