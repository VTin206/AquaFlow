package com.aquaflow.inventory.api.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** {@code name} không bắt buộc: bỏ trống thì giữ tên cũ. */
public record UpdateBottleTypeRequest(
        @Size(max = 100, message = "Name must not exceed 100 characters")
        String name,

        @NotNull(message = "Deposit amount is required")
        @Digits(integer = 12, fraction = 2, message = "Deposit amount must have at most 12 integer digits and 2 decimals")
        @PositiveOrZero(message = "Deposit amount must be greater than or equal to 0")
        BigDecimal depositUnitAmount) {
}