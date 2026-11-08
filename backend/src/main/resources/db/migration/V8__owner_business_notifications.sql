-- System-generated alerts have no human author. Existing manual messages remain unchanged.
ALTER TABLE notifications ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE notifications
    ADD COLUMN kind VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN entity_type VARCHAR(20),
    ADD COLUMN entity_id BIGINT,
    ADD COLUMN source_key VARCHAR(100),
    ADD COLUMN resolved_at TIMESTAMPTZ,
    ADD CONSTRAINT chk_notification_kind CHECK (kind IN
        ('MANUAL', 'ORDER_PENDING', 'ORDER_OVERDUE', 'DELIVERY_FAILED', 'LOW_STOCK', 'BATCH_EXPIRING', 'BATCH_EXPIRED')),
    ADD CONSTRAINT chk_notification_source CHECK (
        (kind = 'MANUAL' AND source_key IS NULL AND entity_type IS NULL AND entity_id IS NULL)
        OR (kind <> 'MANUAL' AND source_key IS NOT NULL AND entity_type IN ('ORDER', 'PRODUCT', 'BATCH') AND entity_id > 0));
CREATE UNIQUE INDEX uq_notifications_active_source ON notifications(recipient_id, source_key)
    WHERE source_key IS NOT NULL AND resolved_at IS NULL;
DROP INDEX idx_notifications_unread;
CREATE INDEX idx_notifications_unread ON notifications(recipient_id) WHERE read_at IS NULL AND resolved_at IS NULL;
