package com.aquaflow.inventory.domain;

public enum MovementReferenceType {
    PURCHASE_RECEIPT,
    ORDER,
    /** Kiểm kê: chứng từ trong bảng stock_adjustments. */
    ADJUSTMENT
}
