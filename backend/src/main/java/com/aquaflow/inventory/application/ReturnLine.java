package com.aquaflow.inventory.application;

public record ReturnLine(Long orderItemId, Long batchId, int resellableQuantity, int damagedQuantity) {
    public ReturnLine {
        if (resellableQuantity < 0 || damagedQuantity < 0 || resellableQuantity + damagedQuantity == 0) {
            throw new IllegalArgumentException("Số lượng hàng hoàn không hợp lệ");
        }
    }
}
