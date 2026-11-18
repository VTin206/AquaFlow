-- Cọc vỏ thu tại điểm giao: ghi vào sổ cọc của khách (deposit_transactions COLLECT), không tạo payment
-- để không lẫn vào doanh thu/tiền hàng; delivery_collections giữ số cọc để đối soát chuyến.
ALTER TABLE delivery_collections
    ADD COLUMN deposit_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
    ADD COLUMN deposit_request_id UUID UNIQUE REFERENCES bottle_ledger_requests(id);
-- Ràng buộc cũ (amount > 0 OR bottles_returned > 0) không đặt tên ở V16: tìm theo nội dung rồi bỏ.
DO $$
DECLARE c text;
BEGIN
    FOR c IN SELECT conname FROM pg_constraint
             WHERE conrelid = 'delivery_collections'::regclass AND contype = 'c'
               AND pg_get_constraintdef(oid) LIKE '%amount > %' AND pg_get_constraintdef(oid) LIKE '%bottles_returned > %'
    LOOP
        EXECUTE format('ALTER TABLE delivery_collections DROP CONSTRAINT %I', c);
    END LOOP;
END $$;
ALTER TABLE delivery_collections ADD CONSTRAINT chk_delivery_collections_value
    CHECK (amount > 0 OR bottles_returned > 0 OR deposit_amount > 0);

-- Đối soát: tiền cọc tài xế báo nộp và chủ cửa hàng thực nhận (dữ liệu cũ = 0).
ALTER TABLE handover_records
    ADD COLUMN deposit_reported NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (deposit_reported >= 0),
    ADD COLUMN deposit_confirmed NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (deposit_confirmed >= 0);
