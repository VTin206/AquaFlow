package com.aquaflow.customer.order.api.dto;

import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderChannel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record OrderCreateRequest(

        @Positive(message = "Customer ID must be positive")
        Long customerId,

        @NotNull(message = "Order channel is required")
        OrderChannel channel,

        @NotNull(message = "Fulfillment type is required")
        FulfillmentType fulfillmentType,

        @Size(max = 150, message = "Recipient name must not exceed 150 characters")
        String recipientName,

        @Pattern(
                regexp = "^(0|\\+84)[0-9]{9,10}$",
                message = "Recipient phone must be a valid Vietnamese phone number"
        )
        String recipientPhone,

        String deliveryAddress,

        @Size(max = 150, message = "Delivery area must not exceed 150 characters")
        String deliveryArea,

        OffsetDateTime requestedDeliveryAt,

        @NotNull(message = "Delivery fee is required")
        @DecimalMin(value = "0.00", message = "Delivery fee must not be negative")
        @Digits(
                integer = 12,
                fraction = 2,
                message = "Delivery fee must have at most 12 integer digits and 2 decimal places"
        )
        BigDecimal deliveryFee,

        @NotEmpty(message = "Order must contain at least one item")
        List<@NotNull @Valid OrderItemRequest> items,

        String note

) {
}
