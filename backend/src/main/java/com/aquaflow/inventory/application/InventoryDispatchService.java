package com.aquaflow.inventory.application;

import com.aquaflow.inventory.domain.InventoryBalance;
import com.aquaflow.inventory.domain.InventoryMovement;
import com.aquaflow.inventory.domain.MovementReferenceType;
import com.aquaflow.inventory.domain.MovementType;
import com.aquaflow.inventory.domain.StockReservation;
import com.aquaflow.inventory.repository.InventoryBalanceRepository;
import com.aquaflow.inventory.repository.InventoryMovementRepository;
import com.aquaflow.inventory.repository.StockReservationRepository;
import com.aquaflow.shared.api.ConflictException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;

@Service
public class InventoryDispatchService {

    private final InventoryBalanceRepository balanceRepository;
    private final StockReservationRepository reservationRepository;
    private final InventoryMovementRepository movementRepository;
    private final Clock clock;

    public InventoryDispatchService(
            InventoryBalanceRepository balanceRepository,
            StockReservationRepository reservationRepository,
            InventoryMovementRepository movementRepository,
            Clock clock) {
        this.balanceRepository = balanceRepository;
        this.reservationRepository = reservationRepository;
        this.movementRepository = movementRepository;
        this.clock = clock;
    }

    @Transactional
    public List<DispatchedLine> dispatch(Long orderId, Collection<Long> orderItemIds, Long performedBy) {
        if (orderItemIds.isEmpty()) {
            throw new IllegalArgumentException("Đơn hàng không có dòng nào để xuất kho");
        }
        List<StockReservation> all = reservationRepository.findByOrderItemIdIn(orderItemIds);
        List<StockReservation> pending = all.stream()
                .filter(r -> r.getOutstanding() > 0)
                .sorted(Comparator.comparing((StockReservation r) -> r.getBatch().getId())
                        .thenComparing(StockReservation::getId, Comparator.nullsFirst(Comparator.naturalOrder())))
                .toList();

        for (Long orderItemId : orderItemIds) {
            if (pending.stream().noneMatch(r -> r.getOrderItemId().equals(orderItemId))) {
                throw new ConflictException(all.stream().anyMatch(r -> r.getOrderItemId().equals(orderItemId))
                        ? "Dòng đơn " + orderItemId + " đã được xuất kho hoặc đã giải phóng"
                        : "Dòng đơn " + orderItemId + " chưa được giữ hàng");
            }
        }

        LocalDate today = LocalDate.now(clock);
        for (StockReservation reservation : pending) {
            if (!reservation.getBatch().isSellableOn(today)) {
                throw new ConflictException("Lô " + reservation.getBatch().getLotCode()
                        + " đã hết hạn, không thể xuất kho");
            }
            int quantity = reservation.dispatchAll();
            lockBalance(reservation).dispatch(quantity);
            movementRepository.save(new InventoryMovement(
                    reservation.getBatch(), MovementType.DISPATCH, quantity,
                    MovementReferenceType.ORDER, orderId, null, performedBy));
        }
        return pending.stream().map(InventoryDispatchService::toLine).toList();
    }

    @Transactional
    public List<DispatchedLine> receiveReturn(Long orderId, Collection<ReturnLine> lines, String reason, Long performedBy) {
        if (lines.isEmpty()) {
            throw new IllegalArgumentException("Chưa có dòng hàng hoàn nào");
        }
        List<Long> orderItemIds = lines.stream().map(ReturnLine::orderItemId).distinct().toList();
        List<StockReservation> reservations = reservationRepository.findByOrderItemIdIn(orderItemIds);

        List<ReturnLine> sorted = lines.stream()
                .sorted(Comparator.comparing(ReturnLine::batchId).thenComparing(ReturnLine::orderItemId))
                .toList();
        for (ReturnLine line : sorted) {
            StockReservation reservation = reservations.stream()
                    .filter(r -> r.getOrderItemId().equals(line.orderItemId())
                            && r.getBatch().getId().equals(line.batchId())
                            && r.getUnreturnedDispatched() > 0)
                    .findFirst()
                    .orElseThrow(() -> new ConflictException("Lô " + line.batchId()
                            + " không có hàng đã xuất chờ trả về cho dòng đơn " + line.orderItemId()));
            reservation.recordReturn(line.resellableQuantity(), line.damagedQuantity());
            if (line.resellableQuantity() > 0) {
                lockBalance(reservation).receive(line.resellableQuantity());
                movementRepository.save(new InventoryMovement(
                        reservation.getBatch(), MovementType.RETURN, line.resellableQuantity(),
                        MovementReferenceType.ORDER, orderId, reason, performedBy));
            }
        }
        return reservations.stream()
                .filter(r -> r.getQuantityDispatched() > 0)
                .map(InventoryDispatchService::toLine)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DispatchedLine> findDispatched(Collection<Long> orderItemIds) {
        return reservationRepository.findDispatchedByOrderItemIdIn(orderItemIds).stream()
                .map(InventoryDispatchService::toLine)
                .toList();
    }

    private InventoryBalance lockBalance(StockReservation reservation) {
        Long batchId = reservation.getBatch().getId();
        return balanceRepository.findForUpdateByBatchId(batchId)
                .orElseThrow(() -> new IllegalStateException("Missing inventory balance for batch " + batchId));
    }

    private static DispatchedLine toLine(StockReservation r) {
        return new DispatchedLine(
                r.getId(), r.getOrderItemId(), r.getBatch().getProduct().getId(), r.getBatch().getId(),
                r.getBatch().getLotCode(), r.getBatch().getExpiresOn(),
                r.getQuantityDispatched(), r.getQuantityReturned(), r.getQuantityDamaged(),
                r.getUnreturnedDispatched());
    }
}
