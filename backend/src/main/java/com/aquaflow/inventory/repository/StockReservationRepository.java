package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.StockReservation;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface StockReservationRepository extends JpaRepository<StockReservation, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<StockReservation> findByOrderItemIdIn(Collection<Long> orderItemIds);

    @Query("""
            select r from StockReservation r join fetch r.batch b join fetch b.product
            where r.orderItemId in :orderItemIds and r.quantityDispatched > 0
            order by r.orderItemId asc, b.expiresOn asc, r.id asc
            """)
    List<StockReservation> findDispatchedByOrderItemIdIn(@Param("orderItemIds") Collection<Long> orderItemIds);
}
