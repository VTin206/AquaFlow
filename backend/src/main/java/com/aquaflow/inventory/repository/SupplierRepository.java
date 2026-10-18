package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {
}