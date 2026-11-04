package com.aquaflow.auth.api.dto;

import jakarta.validation.constraints.*;
import com.aquaflow.auth.domain.UserStatus;

public final class StaffRequests {
    private StaffRequests() {}
    public record Create(
            @NotBlank @Size(max = 150) String fullName,
            @NotBlank @Email @Size(max = 150) String email,
            @Size(max = 20) String phone,
            @NotBlank @Pattern(regexp = "SALES_STAFF|DELIVERY_STAFF") String role,
            @NotBlank @Size(min = 12, max = 72) String password) {}
    public record Update(
            @NotBlank @Size(max = 150) String fullName,
            @Size(max = 20) String phone,
            @NotNull UserStatus status) {}
    public record Password(@NotBlank @Size(min = 12, max = 72) String password) {}
}
