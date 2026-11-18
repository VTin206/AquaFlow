package com.aquaflow.inventory.api.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record ProductResponse(
        Long id,
        String sku,
        String name,
        String brand,
        String unit,
        Integer unitsPerCase,
        Long bottleTypeId,
        String bottleTypeName,
        BigDecimal salePrice,
        boolean active,
        Instant createdAt,
        String image,
        int lowStockThreshold,
        /** Loại sản phẩm; null: chưa phân loại. */
        Long categoryId,
        String categoryName,
        /** null: chưa có dung tích. */
        Integer volumeMl
) {
    public ProductResponse(Long id, String sku, String name, String brand, String unit, Integer unitsPerCase, Long bottleTypeId,
            String bottleTypeName, BigDecimal salePrice, boolean active, Instant createdAt, String image) {
        this(id, sku, name, brand, unit, unitsPerCase, bottleTypeId, bottleTypeName, salePrice, active, createdAt, image,
                com.aquaflow.inventory.domain.Product.DEFAULT_LOW_STOCK_THRESHOLD);
    }

    public ProductResponse(Long id, String sku, String name, String brand, String unit, Integer unitsPerCase, Long bottleTypeId,
            String bottleTypeName, BigDecimal salePrice, boolean active, Instant createdAt, String image, int lowStockThreshold) {
        this(id, sku, name, brand, unit, unitsPerCase, bottleTypeId, bottleTypeName, salePrice, active, createdAt, image,
                lowStockThreshold, null, null, null);
    }
}
