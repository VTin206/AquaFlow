package com.aquaflow.inventory.api.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CreateProductRequest(
        /** Để trống: hệ thống tự cấp mã SP00001, SP00002... */
        @Size(max = 64, message = "SKU must not exceed 64 characters")
        String sku,

        @NotBlank(message = "Name is required")
        @Size(max = 200, message = "Name must not exceed 200 characters")
        String name,

        @Size(max = 150, message = "Brand must not exceed 150 characters")
        String brand,

        @NotBlank(message = "Unit is required")
        @Size(max = 40, message = "Unit must not exceed 40 characters")
        String unit,

        @Positive(message = "Units per case must be greater than 0")
        Integer unitsPerCase,

        @Positive(message = "Bottle type id must be greater than 0")
        Long bottleTypeId,

        @NotNull(message = "Sale price is required")
        @PositiveOrZero(message = "Sale price must be greater than or equal to 0")
        @Digits(integer = 12, fraction = 2, message = "Sale price must have at most 12 integer digits and 2 decimals")
        BigDecimal salePrice,

        @Size(max = 7000000, message = "Image must not exceed 5 MB encoded as a data URL")
        String image,

        @PositiveOrZero(message = "Low stock threshold must be greater than or equal to 0")
        Integer lowStockThreshold,

        /** Loại sản phẩm (ProductCategory). Thiếu hoặc 0: chưa phân loại. */
        @PositiveOrZero(message = "Category id must be greater than or equal to 0")
        Long categoryId,

        /** Dung tích một chai/bình (ml). Thiếu: giữ nguyên khi sửa. 0: chưa có dung tích. */
        @jakarta.validation.constraints.PositiveOrZero(message = "Volume must be greater than or equal to 0")
        @jakarta.validation.constraints.Max(value = 100000, message = "Volume must not exceed 100000 ml")
        Integer volumeMl
) {
    public CreateProductRequest(String sku, String name, String brand, String unit, Integer unitsPerCase, Long bottleTypeId, BigDecimal salePrice, String image) {
        this(sku, name, brand, unit, unitsPerCase, bottleTypeId, salePrice, image, null);
    }

    public CreateProductRequest(String sku, String name, String brand, String unit, Integer unitsPerCase, Long bottleTypeId,
                                BigDecimal salePrice, String image, Integer lowStockThreshold) {
        this(sku, name, brand, unit, unitsPerCase, bottleTypeId, salePrice, image, lowStockThreshold, null, null);
    }
}
