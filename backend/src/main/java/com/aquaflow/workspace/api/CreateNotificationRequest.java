package com.aquaflow.workspace.api;

import jakarta.validation.constraints.*;

public record CreateNotificationRequest(@NotNull @Positive Long recipientId,
        @NotBlank @Size(max = 150) String title, @NotBlank @Size(max = 2000) String message) {}
