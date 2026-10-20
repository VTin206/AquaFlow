package com.aquaflow.inventory.api.dto;

import java.math.BigDecimal;

public record BottleTypeResponse(
        Long id,
        String name,
        BigDecimal depositUnitAmount,
        boolean active) {
}