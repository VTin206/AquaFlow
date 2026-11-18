package com.aquaflow.customer.order.api.dto;

import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.domain.PaymentStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Thông tin khách xem được khi tra cứu đơn: không có id nội bộ, người tạo, ghi chú hay lịch sử thao tác.
 * Số điện thoại chỉ hiện dạng che (090****567).
 */
public record PublicOrderResponse(
        String orderCode,
        OrderStatus status,
        FulfillmentType fulfillmentType,
        PaymentStatus paymentStatus,
        boolean deliveryFailed,
        String recipientName,
        String recipientPhone,
        String deliveryAddress,
        String deliveryArea,
        OffsetDateTime requestedDeliveryAt,
        BigDecimal subtotal,
        BigDecimal discountAmount,
        BigDecimal deliveryFee,
        BigDecimal total,
        BigDecimal paid,
        BigDecimal due,
        OffsetDateTime createdAt,
        OffsetDateTime confirmedAt,
        OffsetDateTime deliveredAt,
        OffsetDateTime cancelledAt,
        String trackingToken,
        List<Item> items
) {

    public record Item(
            Long productId,
            String productName,
            String unit,
            Integer quantity,
            BigDecimal unitPrice,
            BigDecimal lineTotal
    ) {
    }
}
