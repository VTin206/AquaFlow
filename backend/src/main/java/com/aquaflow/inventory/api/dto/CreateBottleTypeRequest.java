package com.aquaflow.inventory.api.dto;

import java.math.BigDecimal;

public record CreateBottleTypeRequest(
        String name,
        BigDecimal depositUnitAmount) {
}