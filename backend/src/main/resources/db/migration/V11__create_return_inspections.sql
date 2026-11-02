CREATE TABLE return_inspections (
    id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL,
    inspected_by BIGINT NOT NULL,
    inspected_at TIMESTAMPTZ NOT NULL,
    note TEXT,

    CONSTRAINT uq_return_inspections_attempt
        UNIQUE (attempt_id),

    CONSTRAINT fk_return_inspections_attempt
        FOREIGN KEY (attempt_id)
        REFERENCES delivery_attempts(id),

    CONSTRAINT fk_return_inspections_inspector
        FOREIGN KEY (inspected_by)
        REFERENCES users(id)
);

CREATE TABLE return_inspection_lines (
    id BIGSERIAL PRIMARY KEY,
    inspection_id BIGINT NOT NULL,
    load_item_id BIGINT NOT NULL,
    quantity_resellable INTEGER NOT NULL,
    quantity_damaged INTEGER NOT NULL,
    note TEXT,

    CONSTRAINT uq_return_inspection_lines_load_item
        UNIQUE (inspection_id, load_item_id),

    CONSTRAINT fk_return_inspection_lines_inspection
        FOREIGN KEY (inspection_id)
        REFERENCES return_inspections(id),

    CONSTRAINT fk_return_inspection_lines_load_item
        FOREIGN KEY (load_item_id)
        REFERENCES delivery_load_items(id),

    CONSTRAINT chk_return_inspection_lines_quantities
        CHECK (
            quantity_resellable >= 0
            AND quantity_damaged >= 0
            AND quantity_resellable + quantity_damaged > 0
        )
);