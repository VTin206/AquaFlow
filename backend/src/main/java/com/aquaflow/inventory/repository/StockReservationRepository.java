package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.StockReservation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface StockReservationRepository extends JpaRepository<StockReservation, Long> {
    List<StockReservation> findByOrderItemIdIn(Collection<Long> orderItemIds);
}
