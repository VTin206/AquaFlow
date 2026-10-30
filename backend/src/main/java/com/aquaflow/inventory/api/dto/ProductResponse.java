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
        String image
) {}
