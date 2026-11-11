package com.aquaflow.customer.order.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Khách tra cứu bằng mã đơn kèm số điện thoại đã đặt hàng. */
public record TrackingLookupRequest(
        @NotBlank(message = "Nhập mã đơn hàng")
        @Size(max = 50, message = "Mã đơn không hợp lệ")
        String orderCode,

        @NotBlank(message = "Nhập số điện thoại đặt hàng")
        @Size(max = 20, message = "Số điện thoại không hợp lệ")
        String phone
) {
}
