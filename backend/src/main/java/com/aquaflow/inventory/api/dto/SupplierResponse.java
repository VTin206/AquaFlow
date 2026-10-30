package com.aquaflow.inventory.api.dto;

public record SupplierResponse(
        Long id,
        String name,
        String phone,
        String address,
        boolean active,
        String contactName,
        String email
) {
    public SupplierResponse(Long id, String name, String phone, String address, boolean active) {
        this(id, name, phone, address, active, null, null);
    }
}