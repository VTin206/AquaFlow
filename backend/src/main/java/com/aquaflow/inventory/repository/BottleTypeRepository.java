package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.BottleType;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BottleTypeRepository extends JpaRepository<BottleType, Long> {
}