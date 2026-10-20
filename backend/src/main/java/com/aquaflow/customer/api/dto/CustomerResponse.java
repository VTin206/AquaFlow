package com.aquaflow.customer.api.dto;

import java.time.Instant;

public record CustomerResponse(
        Long id,
        String fullName,
        String phone,
        Instant createdAt
) {
}
