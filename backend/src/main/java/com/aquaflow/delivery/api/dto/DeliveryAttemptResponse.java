package com.aquaflow.delivery.api.dto;

import com.aquaflow.delivery.domain.DeliveryAttemptOutcome;

import java.time.OffsetDateTime;

public record DeliveryAttemptResponse(

        Long id,

        Long assignmentId,

        Integer attemptNo,

        DeliveryAttemptOutcome outcome,

        String recipientName,

        OffsetDateTime attemptedAt,

        String failureReason,

        String note

) {
}
