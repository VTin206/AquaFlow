package com.aquaflow.customer.api.dto;

import java.time.Instant;

public record CustomerResponse(
        Long id,
        String fullName,
        String phone,
        Instant createdAt,
        String customerType,
        String area,
        String note
) {
    public CustomerResponse(Long id, String fullName, String phone, Instant createdAt) {
        this(id, fullName, phone, createdAt, null, null, null);
    }
}
