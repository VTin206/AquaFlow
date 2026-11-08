CREATE INDEX idx_audit_logs_time ON audit_logs(created_at DESC, id DESC);
CREATE INDEX idx_audit_logs_actor_time ON audit_logs(actor_id, created_at DESC, id DESC);
