package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.PurchaseReceipt;
import com.aquaflow.inventory.domain.PurchaseReceiptStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PurchaseReceiptRepository extends JpaRepository<PurchaseReceipt, Long> {
    @EntityGraph(attributePaths = "supplier")
    List<PurchaseReceipt> findAllByOrderByIdDesc();

    @EntityGraph(attributePaths = "supplier")
    List<PurchaseReceipt> findByStatusOrderByIdDesc(PurchaseReceiptStatus status);

    @EntityGraph(attributePaths = {"supplier", "items", "items.product", "items.batch"})
    Optional<PurchaseReceipt> findWithItemsById(Long id);

    // Khóa phiếu khi xác nhận/hủy để hai người không cùng xác nhận một phiếu (cộng tồn 2 lần)
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from PurchaseReceipt r where r.id = :id")
    Optional<PurchaseReceipt> findForUpdateById(@Param("id") Long id);
}
