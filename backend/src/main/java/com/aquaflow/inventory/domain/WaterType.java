package com.aquaflow.inventory.domain;

/**
 * Loại nước để lọc danh mục. {@link #UNSPECIFIED} chỉ dùng trong request để xóa giá trị đã lưu
 * (thiếu field thì giữ nguyên, như ảnh và ngưỡng tồn); cột products.water_type khi đó là NULL.
 */
public enum WaterType {
    PURIFIED,
    MINERAL,
    ALKALINE,
    REMINERALIZED,
    SPARKLING,
    ELECTROLYTE,
    /** Vỏ bình và phụ kiện. */
    CONTAINER,
    UNSPECIFIED;

    public WaterType stored() {
        return this == UNSPECIFIED ? null : this;
    }
}
