package com.aquaflow.customer.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Khách tự đổi mật khẩu: phải nhập đúng mật khẩu hiện tại; mật khẩu mới cùng quy tắc với lúc đăng ký. */
public record ChangePasswordRequest(
        @NotBlank @Size(max = 128) String currentPassword,
        @NotBlank @Size(min = 8, max = 128) String newPassword) {}
