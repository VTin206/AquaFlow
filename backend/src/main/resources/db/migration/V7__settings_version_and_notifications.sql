ALTER TABLE store_settings ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_id BIGINT NOT NULL REFERENCES users(id),
    title VARCHAR(150) NOT NULL,
    message VARCHAR(2000) NOT NULL,
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
CREATE INDEX idx_notifications_recipient_created ON notifications(recipient_id, created_at DESC, id DESC);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id) WHERE read_at IS NULL;
