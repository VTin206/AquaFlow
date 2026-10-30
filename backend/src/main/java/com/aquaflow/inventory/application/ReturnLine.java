package com.aquaflow.inventory.application;

/** Kết quả kiểm tra hàng hoàn của một lô thuộc một dòng đơn: bao nhiêu bán lại được, bao nhiêu hư hỏng. */
public record ReturnLine(Long orderItemId, Long batchId, int resellableQuantity, int damagedQuantity) {
    public ReturnLine {
        if (resellableQuantity < 0 || damagedQuantity < 0 || resellableQuantity + damagedQuantity == 0) {
            throw new IllegalArgumentException("Số lượng hàng hoàn không hợp lệ");
        }
    }
}
