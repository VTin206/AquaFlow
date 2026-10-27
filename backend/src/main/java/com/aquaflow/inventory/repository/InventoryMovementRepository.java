package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.InventoryMovement;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, Long> {
}
