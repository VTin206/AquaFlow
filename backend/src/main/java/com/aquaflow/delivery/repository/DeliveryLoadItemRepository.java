package com.aquaflow.delivery.repository;

import com.aquaflow.delivery.domain.DeliveryLoadItem;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DeliveryLoadItemRepository
        extends JpaRepository<DeliveryLoadItem, Long> {

    List<DeliveryLoadItem>
    findAllByAssignmentIdOrderByOrderItemIdAscBatchIdAsc(
            Long assignmentId);

    List<DeliveryLoadItem>
    findAllByAssignmentIdAndOrderItemIdInOrderByOrderItemIdAscBatchIdAsc(
            Long assignmentId,
            Collection<Long> orderItemIds);

    boolean existsByAssignmentId(Long assignmentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select item
            from DeliveryLoadItem item
            where item.assignmentId = :assignmentId
              and item.orderItemId = :orderItemId
              and item.batchId = :batchId
            """)
    Optional<DeliveryLoadItem>
    findForUpdateByAssignmentAndOrderItemAndBatch(
            @Param("assignmentId") Long assignmentId,
            @Param("orderItemId") Long orderItemId,
            @Param("batchId") Long batchId);
}
