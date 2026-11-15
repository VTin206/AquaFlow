package com.aquaflow.inventory.application;

import com.aquaflow.inventory.api.dto.StockAdjustmentDtos.Create;
import com.aquaflow.inventory.api.dto.StockAdjustmentDtos.Response;
import com.aquaflow.inventory.domain.InventoryBalance;
import com.aquaflow.inventory.domain.InventoryMovement;
import com.aquaflow.inventory.domain.MovementReferenceType;
import com.aquaflow.inventory.domain.MovementType;
import com.aquaflow.inventory.domain.ProductBatch;
import com.aquaflow.inventory.repository.InventoryBalanceRepository;
import com.aquaflow.inventory.repository.InventoryMovementRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;

/** Kiểm kê theo lô: đưa tồn trên sổ về đúng số đếm thực tế, mỗi lần là một chứng từ DC-xxxxx trong sổ kho. */
@Service
public class StockAdjustmentService {
    private final InventoryBalanceRepository balances;
    private final InventoryMovementRepository movements;
    private final JdbcTemplate jdbc;

    public StockAdjustmentService(InventoryBalanceRepository balances, InventoryMovementRepository movements, JdbcTemplate jdbc) {
        this.balances = balances;
        this.movements = movements;
        this.jdbc = jdbc;
    }

    @Transactional
    public Response adjust(Create request, long actorId) {
        InventoryBalance balance = balances.findForUpdateByBatchId(request.batchId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lô hàng"));
        int before = balance.getOnHand();
        int delta = request.countedQuantity() - before;
        if (delta == 0) {
            throw new BadRequestException("Số đếm bằng tồn trên sổ, không cần điều chỉnh");
        }
        if (delta > 0) balance.adjustUp(delta);
        else balance.adjustDown(-delta);
        balances.save(balance);

        Instant now = Instant.now();
        long id = jdbc.queryForObject("""
                INSERT INTO stock_adjustments(batch_id, on_hand_before, counted_quantity, reason, performed_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?) RETURNING id
                """, Long.class, request.batchId(), before, request.countedQuantity(), request.reason(), actorId,
                java.sql.Timestamp.from(now));

        ProductBatch batch = balance.getBatch();
        movements.save(new InventoryMovement(batch, delta > 0 ? MovementType.ADJUST_UP : MovementType.ADJUST_DOWN,
                Math.abs(delta), MovementReferenceType.ADJUSTMENT, id, request.reason(), actorId));

        return new Response(id, String.format(Locale.ROOT, "DC-%05d", id), batch.getId(), batch.getLotCode(),
                batch.getProduct().getId(), batch.getProduct().getName(), before, request.countedQuantity(), delta,
                request.reason(), actorId, now);
    }
}
