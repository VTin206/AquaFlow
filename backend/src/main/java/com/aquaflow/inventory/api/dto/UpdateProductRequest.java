package com.aquaflow.inventory.api.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateProductRequest(
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
        Integer lowStockThreshold
) {
    public UpdateProductRequest(String name, String brand, String unit, Integer unitsPerCase, Long bottleTypeId, BigDecimal salePrice, String image) {
        this(name, brand, unit, unitsPerCase, bottleTypeId, salePrice, image, null);
    }
}
