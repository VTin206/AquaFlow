package com.aquaflow.delivery.api.dto;

import com.aquaflow.delivery.domain.DeliveryAttemptOutcome;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record DeliveryAttemptCreateRequest(

        @NotNull(message = "Delivery attempt outcome is required")
        DeliveryAttemptOutcome outcome,

        @Size(max = 150, message = "Recipient name must not exceed 150 characters")
        String recipientName,

        String failureReason,

        String note

) {

    @JsonIgnore
    @AssertTrue(message = "Failure reason is required for failed delivery attempts and must be empty for successful attempts")
    public boolean isFailureReasonValid() {

        if (outcome == null) {
            return true;
        }

        if (outcome == DeliveryAttemptOutcome.FAILED) {
            return failureReason != null
                    && !failureReason.isBlank();
        }

        return failureReason == null
                || failureReason.isBlank();
    }
}
