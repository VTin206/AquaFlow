package com.aquaflow.delivery.api.dto;

import com.aquaflow.customer.order.domain.OrderStatus;

import java.util.List;

public record DeliveryDispatchResponse(

        Long assignmentId,

        Long orderId,

        OrderStatus orderStatus,

        List<DeliveryDispatchLineResponse> lines

) {
}
