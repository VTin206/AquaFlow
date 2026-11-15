package com.aquaflow.customer.order.api.dto;

import com.aquaflow.shared.address.DeliveryWard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Sửa đơn còn chờ xác nhận: người nhận, địa chỉ, giờ hẹn, ghi chú và hàng. Kênh, hình thức nhận và phí giao giữ nguyên.
 */
public record OrderUpdateRequest(
        @Size(max = 150, message = "Recipient name must not exceed 150 characters")
        String recipientName,

        @Pattern(
                regexp = "^(0|\\+84)[0-9]{9,10}$",
                message = "Recipient phone must be a valid Vietnamese phone number"
        )
        String recipientPhone,

        String deliveryAddress,

        @Size(max = 150, message = "Delivery area must not exceed 150 characters")
        @DeliveryWard
        String deliveryArea,

        OffsetDateTime requestedDeliveryAt,

        @NotEmpty(message = "Order must contain at least one item")
        List<@NotNull @Valid OrderItemRequest> items,

        @Size(max = 500, message = "Note must not exceed 500 characters")
        String note) {
}
