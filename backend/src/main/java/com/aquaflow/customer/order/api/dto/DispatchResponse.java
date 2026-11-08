package com.aquaflow.customer.order.api.dto;

import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.inventory.application.DispatchedLine;
import java.time.OffsetDateTime;
import java.util.List;

public record DispatchResponse(Long id, Long orderId, Long performedBy, OffsetDateTime dispatchedAt,
                               OrderStatus orderStatus, List<DispatchedLine> items) {
}
