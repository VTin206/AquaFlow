package com.aquaflow.delivery.repository;

import com.aquaflow.delivery.domain.DeliveryAttempt;
import com.aquaflow.delivery.domain.DeliveryAttemptOutcome;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DeliveryAttemptRepository
        extends JpaRepository<DeliveryAttempt, Long> {

    List<DeliveryAttempt> findAllByAssignmentIdOrderByAttemptNoAsc(
            Long assignmentId);

    Optional<DeliveryAttempt> findFirstByAssignmentIdOrderByAttemptNoDesc(
            Long assignmentId);

    boolean existsByAssignmentIdAndOutcome(
            Long assignmentId,
            DeliveryAttemptOutcome outcome);

    boolean existsByAssignmentId(Long assignmentId);

    @Query(value = """
            SELECT COALESCE(MAX(attempt.attempt_no), 0)
            FROM delivery_attempts attempt
            JOIN delivery_assignments assignment
              ON assignment.id = attempt.assignment_id
            WHERE assignment.order_id = :orderId
            """, nativeQuery = true)
    int findMaxAttemptNoByOrderId(@Param("orderId") Long orderId);
}
