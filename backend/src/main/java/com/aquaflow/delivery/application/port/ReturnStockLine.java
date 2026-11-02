package com.aquaflow.delivery.application.port;

public record ReturnStockLine(
        Long orderItemId,
        Long batchId,
        int resellableQuantity,
        int damagedQuantity) {

    public ReturnStockLine {
        if (orderItemId == null || orderItemId <= 0) {
            throw new IllegalArgumentException(
                    "Order item ID must be positive");
        }

        if (batchId == null || batchId <= 0) {
            throw new IllegalArgumentException(
                    "Batch ID must be positive");
        }

        if (resellableQuantity < 0 || damagedQuantity < 0) {
            throw new IllegalArgumentException(
                    "Return quantities cannot be negative");
        }

        if (resellableQuantity + damagedQuantity == 0) {
            throw new IllegalArgumentException(
                    "At least one returned quantity must be positive");
        }
    }
}
