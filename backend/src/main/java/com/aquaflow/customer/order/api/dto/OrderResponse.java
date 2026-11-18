package com.aquaflow.customer.order.api.dto;

import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderChannel;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.domain.PaymentStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record OrderResponse(

        Long id,

        String orderCode,

        Long customerId,

        Long createdBy,

        OrderChannel channel,

        FulfillmentType fulfillmentType,

        OrderStatus status,

        PaymentStatus paymentStatus,

        String recipientName,

        String recipientPhone,

        String deliveryAddress,

        String deliveryArea,

        OffsetDateTime requestedDeliveryAt,

        BigDecimal subtotal,

        BigDecimal discountAmount,

        BigDecimal deliveryFee,

        BigDecimal total,

        OffsetDateTime createdAt,

        OffsetDateTime confirmedAt,

        OffsetDateTime cancelledAt,

        String note,

        List<OrderItemResponse> items,

        /** Liên kết tra cứu công khai cho khách: /track/{trackingToken}. */
        String trackingToken

) {

    public OrderResponse(
            Long id, String orderCode, Long customerId, Long createdBy, OrderChannel channel,
            FulfillmentType fulfillmentType, OrderStatus status, PaymentStatus paymentStatus,
            String recipientName, String recipientPhone, String deliveryAddress, String deliveryArea,
            OffsetDateTime requestedDeliveryAt, BigDecimal subtotal, BigDecimal discountAmount,
            BigDecimal deliveryFee, BigDecimal total, OffsetDateTime createdAt, OffsetDateTime confirmedAt,
            OffsetDateTime cancelledAt, String note, List<OrderItemResponse> items) {
        this(id, orderCode, customerId, createdBy, channel, fulfillmentType, status, paymentStatus,
                recipientName, recipientPhone, deliveryAddress, deliveryArea, requestedDeliveryAt, subtotal,
                discountAmount, deliveryFee, total, createdAt, confirmedAt, cancelledAt, note, items, null);
    }

    public record OrderItemResponse(

            Long id,

            Long productId,

            Integer quantity,

            BigDecimal unitPrice,

            BigDecimal lineTotal

    ) {
    }
}
