package com.aquaflow.delivery.repository;

import com.aquaflow.delivery.domain.DeliveryAssignment;
import org.springframework.data.jpa.repository.EntityGraph;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DeliveryAssignmentRepository extends JpaRepository<DeliveryAssignment, Long> {

    boolean existsByOrder_IdAndActiveTrue(Long orderId);

    boolean existsByTrip_IdAndActiveTrue(Long tripId);

    @EntityGraph(attributePaths = "order")
    List<DeliveryAssignment> findAllByTrip_IdOrderById(Long tripId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select assignment
            from DeliveryAssignment assignment
            where assignment.id = :assignmentId
            """)
    Optional<DeliveryAssignment> findForUpdateById(
            @Param("assignmentId") Long assignmentId);
}
