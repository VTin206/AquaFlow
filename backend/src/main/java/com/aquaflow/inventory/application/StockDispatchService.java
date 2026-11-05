package com.aquaflow.inventory.application;

import com.aquaflow.inventory.domain.*;
import com.aquaflow.inventory.repository.*;
import com.aquaflow.shared.api.ConflictException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;

@Service
public class StockDispatchService {
    private final StockReservationRepository reservations;
    private final InventoryBalanceRepository balances;
    private final InventoryMovementRepository movements;
    private final Clock clock;

    public StockDispatchService(StockReservationRepository reservations, InventoryBalanceRepository balances,
                                InventoryMovementRepository movements, Clock clock) {
        this.reservations = reservations;
        this.balances = balances;
        this.movements = movements;
        this.clock = clock;
    }

    /** Caller holds the order lock. Export the entire reservation, never an arbitrary client quantity. */
    @Transactional
    public List<DispatchedLine> dispatch(Long orderId, List<ReservationLine> lines, Long actorId, boolean counter) {
        if (lines.isEmpty()) throw new ConflictException("Đơn không có hàng để xuất");
        var held = reservations.findByOrderItemIdIn(lines.stream().map(ReservationLine::orderItemId).toList());
        for (var line : lines) {
            var matching = held.stream().filter(r -> r.getOrderItemId().equals(line.orderItemId())).toList();
            if (matching.isEmpty() || matching.stream().anyMatch(r -> r.getQuantityDispatched() != 0
                    || r.getQuantityReleased() != 0 || !r.getBatch().getProduct().getId().equals(line.productId()))
                    || matching.stream().mapToLong(StockReservation::getOutstanding).sum() != line.quantity()) {
                throw new ConflictException("Hàng giữ cho đơn không đầy đủ hoặc đã được xuất/giải phóng");
            }
        }
        // Same product/FEFO order as reserve() to avoid lock inversions across orders.
        var sorted = held.stream().sorted(Comparator
                .comparing((StockReservation r) -> r.getBatch().getProduct().getId())
                .thenComparing(r -> r.getBatch().getExpiresOn())
                .thenComparing(r -> r.getBatch().getId())).toList();
        List<DispatchedLine> result = new ArrayList<>();
        for (var reservation : sorted) {
            var batch = reservation.getBatch();
            if (!batch.isSellableOn(LocalDate.now(clock))) {
                throw new ConflictException("Lô " + batch.getLotCode() + " đã hết hạn, không thể xuất kho");
            }
            var balance = balances.findForUpdateByBatchId(batch.getId())
                    .orElseThrow(() -> new ConflictException("Không tìm thấy tồn kho của lô " + batch.getLotCode()));
            int quantity = reservation.getOutstanding();
            balance.dispatch(quantity);
            reservation.dispatchOutstanding();
            movements.save(new InventoryMovement(batch, counter ? MovementType.COUNTER_SALE : MovementType.DISPATCH,
                    quantity, MovementReferenceType.ORDER, orderId, "Xuất kho theo đơn", actorId));
            result.add(new DispatchedLine(reservation.getOrderItemId(), batch.getProduct().getId(),
                    batch.getId(), batch.getLotCode(), batch.getExpiresOn(), quantity));
        }
        return result;
    }
}
