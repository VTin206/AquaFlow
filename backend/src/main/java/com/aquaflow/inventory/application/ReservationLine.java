package com.aquaflow.inventory.application;

/** Một dòng cần giữ hàng: dòng đơn hàng nào, sản phẩm nào, bao nhiêu. */
public record ReservationLine(Long orderItemId, Long productId, int quantity) {
    public ReservationLine {
        if (quantity <= 0) {
            throw new IllegalArgumentException("Số lượng giữ phải lớn hơn 0");
        }
    }
}
