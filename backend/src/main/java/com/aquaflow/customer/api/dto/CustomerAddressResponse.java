package com.aquaflow.customer.api.dto;

public record CustomerAddressResponse(
        Long id,
        Long customerId,
        String recipientName,
        String recipientPhone,
        String addressLine,
        String area,
        boolean isDefault
) {
}
