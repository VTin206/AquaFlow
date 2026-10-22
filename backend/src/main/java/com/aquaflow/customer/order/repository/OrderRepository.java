package com.aquaflow.customer.order.repository;

import com.aquaflow.customer.order.domain.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    Optional<Order> findByOrderCode(String orderCode);

    List<Order> findAllByCustomerId(Long customerId);
}
