package com.aquaflow.workspace.api;

import jakarta.validation.constraints.*;

public record StoreSettingsData(
        @NotBlank @Size(max = 150) String storeName,
        @NotNull @Size(max = 500) String address,
        @NotNull @Size(max = 30) @Pattern(regexp = "[0-9+() .-]*") String phone,
        @Email @Size(max = 254) String email,
        @Size(max = 200) String openingHours,
        @Size(max = 30) String taxCode,
        @Size(max = 150) String bankName,
        @Size(max = 50) String bankAccount,
        @Size(max = 150) String bankHolder,
        @Size(max = 1000) String invoiceNote,
        @NotNull @Min(0) @Max(3650) Integer expiryWarningDays,
        @NotNull @Min(0) @Max(1000000) Integer defaultLowStock) {
}
