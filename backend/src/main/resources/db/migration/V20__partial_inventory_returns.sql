ALTER TABLE inventory_returns DROP CONSTRAINT inventory_returns_assignment_id_key;
ALTER TABLE inventory_return_lines DROP CONSTRAINT inventory_return_lines_load_item_id_key;
ALTER TABLE inventory_return_lines ADD CONSTRAINT uq_return_line_per_receipt UNIQUE(return_id, load_item_id);
ALTER TABLE inventory_returns ADD COLUMN request_id UUID UNIQUE;
ALTER TABLE inventory_returns ADD COLUMN request_hash VARCHAR(64);
CREATE INDEX idx_inventory_returns_assignment ON inventory_returns(assignment_id, id);
CREATE INDEX idx_inventory_return_lines_load_item ON inventory_return_lines(load_item_id);
