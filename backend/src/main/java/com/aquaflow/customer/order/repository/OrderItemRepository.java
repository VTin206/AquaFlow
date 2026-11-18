package com.aquaflow.customer.order.repository;

import com.aquaflow.customer.order.domain.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderItemRepository
        extends JpaRepository<OrderItem, Long> {

    List<OrderItem> findAllByOrder_Id(Long orderId);

    /** Nạp dòng hàng của nhiều đơn trong một truy vấn khi trả danh sách đơn. */
    List<OrderItem> findAllByOrder_IdIn(java.util.Collection<Long> orderIds);
}
