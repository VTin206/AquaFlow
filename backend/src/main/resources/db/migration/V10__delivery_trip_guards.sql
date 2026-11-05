-- V1/V6 already provide delivery_trips, assignments, attempts, load items and handover_records.
-- V9 already provides immutable order_dispatches and their batch line items.
-- This migration adds indexes and protects the trip load manifest from duplicates.

CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_load_items_assignment_item_batch
    ON delivery_load_items(assignment_id, order_item_id, batch_id);

CREATE INDEX IF NOT EXISTS idx_delivery_trips_driver_status
    ON delivery_trips(driver_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_assignment_latest
    ON delivery_attempts(assignment_id, attempt_no DESC);
