package com.aquaflow.workspace.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public record UpdateStoreSettingsRequest(@NotNull @Valid StoreSettingsData settings,
                                         @NotNull @PositiveOrZero Long version) {}
