CREATE INDEX idx_inventory_movements_time_id ON inventory_movements(occurred_at DESC, id DESC);
