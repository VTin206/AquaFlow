package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.PurchaseReceipt;
import com.aquaflow.inventory.domain.PurchaseReceiptStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PurchaseReceiptRepository extends JpaRepository<PurchaseReceipt, Long> {
    /** Một trang mã phiếu, ngày nhận mới nhất trước; chi tiết nạp riêng bằng {@link #findWithItemsByIdIn}. */
    @Query(value = """
            select r.id from PurchaseReceipt r
            where (:status is null or r.status = :status)
            order by r.receivedAt desc nulls last, r.id desc
            """,
            countQuery = "select count(r) from PurchaseReceipt r where (:status is null or r.status = :status)")
    Page<Long> findPageIds(@Param("status") PurchaseReceiptStatus status, Pageable pageable);

    /** Nạp phiếu kèm nhà cung cấp, dòng hàng, sản phẩm và lô trong một truy vấn. */
    @EntityGraph(attributePaths = {"supplier", "items", "items.product", "items.batch"})
    List<PurchaseReceipt> findWithItemsByIdIn(Collection<Long> ids);

    interface StatusCount {
        PurchaseReceiptStatus getStatus();
        long getTotal();
    }

    @Query("select r.status as status, count(r) as total from PurchaseReceipt r group by r.status")
    List<StatusCount> countByStatus();

    /** Một dòng hàng của phiếu đã nhập kho, dùng để ghép thông tin nguồn cho từng lô. */
    interface ConfirmedLine {
        Long getBatchId();
        Long getReceiptId();
        Instant getReceivedAt();
        LocalDate getManufacturedOn();
        int getQuantityAccepted();
        BigDecimal getUnitCost();
    }

    @Query("""
            select i.batch.id as batchId, r.id as receiptId, r.receivedAt as receivedAt,
                   i.batch.manufacturedOn as manufacturedOn, i.quantityAccepted as quantityAccepted, i.unitCost as unitCost
            from PurchaseItem i join i.receipt r
            where r.status = com.aquaflow.inventory.domain.PurchaseReceiptStatus.CONFIRMED and i.batch is not null
            order by r.receivedAt, r.id, i.id
            """)
    List<ConfirmedLine> findConfirmedLines();

    @EntityGraph(attributePaths = {"supplier", "items", "items.product", "items.batch"})
    Optional<PurchaseReceipt> findWithItemsById(Long id);

    // Khóa phiếu khi xác nhận/hủy để hai người không cùng xác nhận một phiếu (cộng tồn 2 lần)
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from PurchaseReceipt r where r.id = :id")
    Optional<PurchaseReceipt> findForUpdateById(@Param("id") Long id);
}
