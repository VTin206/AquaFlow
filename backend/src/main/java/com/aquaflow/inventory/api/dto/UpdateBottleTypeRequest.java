package com.aquaflow.inventory.api.dto;

import java.math.BigDecimal;

public record UpdateBottleTypeRequest(
        BigDecimal depositUnitAmount
) {
}