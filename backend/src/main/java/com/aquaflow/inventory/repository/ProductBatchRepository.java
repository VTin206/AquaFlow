package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.ProductBatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProductBatchRepository extends JpaRepository<ProductBatch, Long> {
    Optional<ProductBatch> findByProductIdAndLotCode(Long productId, String lotCode);
}
