-- Thông báo cho nhân viên giao hàng: chuyến mới được giao, và đơn trong chuyến của mình đã quá giờ hẹn.
-- Chỉ nới ràng buộc để cho phép loại và đối tượng mới; không sửa hay xóa dữ liệu nào.
ALTER TABLE notifications
    DROP CONSTRAINT chk_notification_kind,
    DROP CONSTRAINT chk_notification_source;
ALTER TABLE notifications
    ADD CONSTRAINT chk_notification_kind CHECK (kind IN
        ('MANUAL', 'ORDER_PENDING', 'ORDER_OVERDUE', 'DELIVERY_FAILED', 'LOW_STOCK', 'BATCH_EXPIRING', 'BATCH_EXPIRED',
         'TRIP_ASSIGNED', 'TRIP_ORDER_OVERDUE')),
    ADD CONSTRAINT chk_notification_source CHECK (
        (kind = 'MANUAL' AND source_key IS NULL AND entity_type IS NULL AND entity_id IS NULL)
        OR (kind <> 'MANUAL' AND source_key IS NOT NULL AND entity_type IN ('ORDER', 'PRODUCT', 'BATCH', 'TRIP') AND entity_id > 0));
