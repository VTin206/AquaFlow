package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.InventoryBalance;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface InventoryBalanceRepository extends JpaRepository<InventoryBalance, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from InventoryBalance b where b.batchId = :batchId")
    Optional<InventoryBalance> findForUpdateByBatchId(@Param("batchId") Long batchId);

    /**
     * Khóa (SELECT ... FOR UPDATE) các lô còn hạn và còn hàng khả dụng của sản phẩm,
     * sắp theo hạn sử dụng tăng dần (FEFO). Phải gọi trong transaction.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select b from InventoryBalance b join fetch b.batch pb
            where pb.product.id = :productId
              and pb.expiresOn > :today
              and b.onHand > b.reserved
            order by pb.expiresOn asc, pb.id asc
            """)
    List<InventoryBalance> lockSellableByProductFefo(@Param("productId") Long productId, @Param("today") LocalDate today);

    @Query("""
            select b from InventoryBalance b join fetch b.batch pb
            where pb.product.id = :productId
            order by pb.expiresOn asc
            """)
    List<InventoryBalance> findByProductWithBatch(@Param("productId") Long productId);

    @Query("""
            select b from InventoryBalance b join fetch b.batch pb join fetch pb.product p
            order by p.id asc, pb.expiresOn asc
            """)
    List<InventoryBalance> findAllWithBatch();
}
