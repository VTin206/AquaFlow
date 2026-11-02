package com.aquaflow.delivery.application.port;

import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderStatus;

public record DeliveryAssignmentSnapshot(

        Long assignmentId,

        Long orderId,

        FulfillmentType fulfillmentType,

        OrderStatus orderStatus,

        boolean active

) {
}
