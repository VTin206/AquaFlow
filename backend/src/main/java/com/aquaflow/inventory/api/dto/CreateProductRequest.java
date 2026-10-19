package com.aquaflow.inventory.api.dto;

import java.math.BigDecimal;

public record CreateProductRequest(
        String sku,
        String name,
        String brand,
        String unit,
        Integer unitsPerCase,
        Long bottleTypeId,
        BigDecimal salePrice
) {}