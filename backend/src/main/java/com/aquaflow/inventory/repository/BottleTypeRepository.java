package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.BottleType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BottleTypeRepository extends JpaRepository<BottleType, Long> {
    List<BottleType> findByActive(Boolean active);
    boolean existsByName(String name);
}
