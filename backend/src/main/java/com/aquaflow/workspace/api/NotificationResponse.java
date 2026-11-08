package com.aquaflow.workspace.api;

import java.time.Instant;

public record NotificationResponse(long id, String title, String message, Instant createdAt, Instant readAt,
        String kind, String entityType, Long entityId, Instant resolvedAt) {}
