package com.aquaflow.workspace.api;

import java.time.Instant;

public record StoreSettingsResponse(StoreSettingsData settings, long version, Instant updatedAt, Long updatedBy) {}
