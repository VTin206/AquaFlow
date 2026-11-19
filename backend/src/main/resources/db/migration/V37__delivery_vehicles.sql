-- Danh mục xe giao hàng và sức chở (tính theo kiện: mỗi bình/thùng/chai trên đơn là một kiện).
-- Chuyến có thể gắn một xe; cột delivery_trips.vehicle (biển số dạng chữ) vẫn giữ cho chuyến cũ.
CREATE TABLE vehicles (
    id BIGSERIAL PRIMARY KEY,
    plate VARCHAR(40) NOT NULL,
    name VARCHAR(100),
    capacity_units INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_vehicles_plate CHECK (btrim(plate) <> ''),
    CONSTRAINT chk_vehicles_capacity CHECK (capacity_units BETWEEN 1 AND 10000)
);
CREATE UNIQUE INDEX uq_vehicles_plate ON vehicles(lower(btrim(plate)));

ALTER TABLE delivery_trips ADD COLUMN vehicle_id BIGINT REFERENCES vehicles(id);
CREATE INDEX idx_delivery_trips_vehicle_status ON delivery_trips(vehicle_id, status);
