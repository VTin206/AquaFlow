package com.aquaflow.delivery.repository;

import com.aquaflow.delivery.domain.DeliveryAssignment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeliveryAssignmentRepository extends JpaRepository<DeliveryAssignment, Long> {

    boolean existsByOrder_IdAndActiveTrue(Long orderId);

    boolean existsByTrip_IdAndActiveTrue(Long tripId);

    @EntityGraph(attributePaths = "order")
    List<DeliveryAssignment> findAllByTrip_IdOrderById(Long tripId);
}
