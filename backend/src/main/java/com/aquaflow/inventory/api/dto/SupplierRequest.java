package com.aquaflow.inventory.api.dto;

public record SupplierRequest(
        String name,
        String phone,
        String address
) {
}