-- Kiểm kê theo lô: mỗi lần điều chỉnh là một chứng từ, sổ kho trỏ về bằng reference_type = 'ADJUSTMENT'.
CREATE TABLE stock_adjustments (
    id BIGSERIAL PRIMARY KEY,
    batch_id BIGINT NOT NULL REFERENCES product_batches(id),
    on_hand_before INTEGER NOT NULL,
    counted_quantity INTEGER NOT NULL,
    reason VARCHAR(300) NOT NULL,
    performed_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_stock_adjustments_before CHECK (on_hand_before >= 0),
    CONSTRAINT chk_stock_adjustments_counted CHECK (counted_quantity >= 0),
    CONSTRAINT chk_stock_adjustments_changed CHECK (counted_quantity <> on_hand_before)
);
CREATE INDEX idx_stock_adjustments_batch ON stock_adjustments(batch_id);

-- Hủy phiếu thu ghi nhầm: phiếu chuyển REJECTED (mọi số dư chỉ tính CONFIRMED) và giữ lại ai hủy, khi nào, vì sao.
ALTER TABLE payments
    ADD COLUMN voided_by BIGINT REFERENCES users(id),
    ADD COLUMN voided_at TIMESTAMPTZ,
    ADD COLUMN void_reason VARCHAR(300);

-- Hủy giao dịch vỏ/cọc ghi nhầm: ghi một dòng VOID đảo dòng gốc, mỗi dòng gốc chỉ bị hủy một lần.
ALTER TABLE bottle_ledger_requests DROP CONSTRAINT bottle_ledger_requests_kind_check;
ALTER TABLE bottle_ledger_requests
    ADD CONSTRAINT bottle_ledger_requests_kind_check CHECK (kind IN ('GIVE','RECEIVE','LOSS','COLLECT','REFUND','VOID')),
    ADD COLUMN voids_request_id UUID UNIQUE REFERENCES bottle_ledger_requests(id);
