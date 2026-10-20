package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {
    List<Supplier> findByActive(boolean active);
}