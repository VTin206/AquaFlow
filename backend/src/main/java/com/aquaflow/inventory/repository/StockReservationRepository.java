package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.StockReservation;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Collection;
import java.util.List;

public interface StockReservationRepository extends JpaRepository<StockReservation, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<StockReservation> findByOrderItemIdIn(Collection<Long> orderItemIds);
}
