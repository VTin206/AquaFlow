package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.PurchaseReceipt;
import com.aquaflow.inventory.domain.PurchaseReceiptStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PurchaseReceiptRepository extends JpaRepository<PurchaseReceipt, Long> {
    @EntityGraph(attributePaths = "supplier")
    List<PurchaseReceipt> findAllByOrderByIdDesc();

    @EntityGraph(attributePaths = "supplier")
    List<PurchaseReceipt> findByStatusOrderByIdDesc(PurchaseReceiptStatus status);

    @EntityGraph(attributePaths = {"supplier", "items", "items.product", "items.batch"})
    Optional<PurchaseReceipt> findWithItemsById(Long id);
}
