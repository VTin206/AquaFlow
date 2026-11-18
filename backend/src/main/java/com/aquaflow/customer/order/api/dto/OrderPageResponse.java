package com.aquaflow.customer.order.api.dto;

import com.aquaflow.customer.order.domain.OrderStatus;

import java.util.List;
import java.util.Map;

/**
 * Một trang đơn hàng. {@code statusCounts} đếm trên toàn bộ đơn (không theo bộ lọc) để trang Đơn hàng
 * hiện số đơn của từng nhóm/trạng thái mà không phải tải hết đơn.
 */
public record OrderPageResponse(
        List<OrderListItem> items,
        int page,
        int size,
        long total,
        int totalPages,
        Map<OrderStatus, Long> statusCounts
) {
}
