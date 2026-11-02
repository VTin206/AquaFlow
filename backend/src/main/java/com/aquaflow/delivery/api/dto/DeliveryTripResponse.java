package com.aquaflow.delivery.api.dto;

import java.time.Instant;
import java.util.List;

public record DeliveryTripResponse(
        Long id,
        Long driverId,
        String driverName,
        String status,
        Instant startedAt,
        Instant endedAt,
        Long createdBy,
        Instant createdAt,
        List<DeliveryAssignmentResponse> assignments
) {
}
