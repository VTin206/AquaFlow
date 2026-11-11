package com.aquaflow.customer.order.application;

import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.shared.api.SearchKeyword;

import java.util.Set;

/**
 * Bộ lọc trang Đơn hàng. Trường {@code null}/rỗng nghĩa là không lọc theo trường đó.
 *
 * @param statuses    các trạng thái được chọn (nhóm "Cần xử lý", "Đang thực hiện"... gửi nhiều trạng thái)
 * @param payment     DUE: còn phải thu; SETTLED: đã thu đủ (đơn hủy không thuộc cả hai)
 */
public record OrderSearch(
        Set<OrderStatus> statuses,
        FulfillmentType fulfillmentType,
        PaymentFilter payment,
        SearchKeyword keyword
) {
    public enum PaymentFilter { DUE, SETTLED }

    public OrderSearch {
        statuses = statuses == null ? Set.of() : Set.copyOf(statuses);
    }
}
