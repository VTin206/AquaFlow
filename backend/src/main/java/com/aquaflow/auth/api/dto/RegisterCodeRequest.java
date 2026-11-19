package com.aquaflow.auth.api.dto;

import jakarta.validation.constraints.*;

/** Xin mã xác nhận trước khi đăng ký; số điện thoại để báo trùng ngay, trước khi gửi mail. */
public record RegisterCodeRequest(
        @NotBlank @Email @Size(max = 150) String email,
        @NotBlank @Pattern(regexp = "^(?:0\\d{9,10}|\\+?84\\d{9,10})$") String phone) {
    public RegisterCodeRequest {
        if (email != null) email = email.trim();
        if (phone != null) phone = phone.trim();
    }
}
