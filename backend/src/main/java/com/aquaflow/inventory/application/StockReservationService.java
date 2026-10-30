package com.aquaflow.inventory.application;

import com.aquaflow.inventory.domain.InventoryBalance;
import com.aquaflow.inventory.domain.StockReservation;
import com.aquaflow.inventory.repository.InventoryBalanceRepository;
import com.aquaflow.inventory.repository.StockReservationRepository;
import com.aquaflow.shared.api.ConflictException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;

/**
 * Giữ và giải phóng hàng cho đơn. Module order gọi các hàm này trong transaction xác nhận/hủy đơn.
 */
@Service
public class StockReservationService {

    private final InventoryBalanceRepository balanceRepository;
    private final StockReservationRepository reservationRepository;
    private final Clock clock;

    public StockReservationService(
            InventoryBalanceRepository balanceRepository,
            StockReservationRepository reservationRepository,
            Clock clock) {
        this.balanceRepository = balanceRepository;
        this.reservationRepository = reservationRepository;
        this.clock = clock;
    }

    /**
     * Giữ hàng theo FEFO (lô hết hạn sớm nhất trước), bỏ qua lô đã hết hạn.
     * Các lô bị khóa SELECT ... FOR UPDATE nên hai đơn không thể cùng chiếm một lượng tồn.
     * Thiếu hàng ở bất kỳ dòng nào thì ném ConflictException và toàn bộ transaction rollback.
     */
    @Transactional
    public List<StockReservation> reserve(Collection<ReservationLine> lines) {
        List<Long> orderItemIds = lines.stream().map(ReservationLine::orderItemId).toList();
        // Reservation cũ đã giải phóng hoặc đã nhận hàng hoàn đủ thì không còn hiệu lực
        if (reservationRepository.findByOrderItemIdIn(orderItemIds).stream().anyMatch(StockReservationService::isActive)) {
            throw new ConflictException("Đơn hàng đã được giữ hàng trước đó");
        }
        return reserveLines(lines);
    }

    /**
     * Giữ hàng mới cho đơn giao lại. Chỉ cho phép khi mọi dòng đã từng xuất kho và toàn bộ hàng
     * đã xuất đã được kiểm tra trả về. Lịch sử xuất kho cũ được giữ nguyên.
     */
    @Transactional
    public List<StockReservation> reserveForRedelivery(Collection<ReservationLine> lines) {
        List<Long> orderItemIds = lines.stream().map(ReservationLine::orderItemId).toList();
        List<StockReservation> existing = reservationRepository.findByOrderItemIdIn(orderItemIds);
        for (Long orderItemId : orderItemIds) {
            List<StockReservation> ofItem = existing.stream()
                    .filter(r -> r.getOrderItemId().equals(orderItemId))
                    .toList();
            if (ofItem.stream().noneMatch(r -> r.getQuantityDispatched() > 0)) {
                throw new ConflictException("Dòng đơn " + orderItemId + " chưa từng xuất kho, không thể giao lại");
            }
            if (ofItem.stream().anyMatch(StockReservationService::isActive)) {
                throw new ConflictException("Dòng đơn " + orderItemId + " chưa hoàn tất xử lý hàng hoàn");
            }
        }
        return reserveLines(lines);
    }

    private List<StockReservation> reserveLines(Collection<ReservationLine> lines) {
        LocalDate today = LocalDate.now(clock);
        List<StockReservation> reservations = new ArrayList<>();
        // Khóa theo thứ tự productId cố định để hai đơn khóa chéo sản phẩm không bị deadlock
        List<ReservationLine> sorted = lines.stream()
                .sorted(Comparator.comparing(ReservationLine::productId))
                .toList();
        for (ReservationLine line : sorted) {
            reservations.addAll(reserveLine(line, today));
        }
        return reservationRepository.saveAll(reservations);
    }

    /** Giải phóng phần hàng chưa xuất của các dòng đơn (dùng khi hủy đơn). Gọi lại nhiều lần vẫn an toàn. */
    @Transactional
    public void release(Collection<Long> orderItemIds) {
        List<StockReservation> reservations = reservationRepository.findByOrderItemIdIn(orderItemIds).stream()
                .sorted(Comparator.comparing(r -> r.getBatch().getId()))
                .toList();

        if (reservations.stream().anyMatch(r -> r.getUnreturnedDispatched() > 0)) {
            throw new ConflictException(
                    "Không thể giải phóng reservation đã có hàng xuất kho");
        }

        for (StockReservation reservation : reservations) {
            int released = reservation.releaseOutstanding();
            if (released == 0) {
                continue;
            }
            InventoryBalance balance = balanceRepository.findForUpdateByBatchId(reservation.getBatch().getId())
                    .orElseThrow(() -> new IllegalStateException(
                            "Missing inventory balance for batch " + reservation.getBatch().getId()));
            balance.release(released);
        }
    }

    /** Còn hàng đang giữ, hoặc hàng đã xuất chưa được kiểm tra trả về. */
    private static boolean isActive(StockReservation reservation) {
        return reservation.getOutstanding() > 0 || reservation.getUnreturnedDispatched() > 0;
    }

    private List<StockReservation> reserveLine(ReservationLine line, LocalDate today) {
        List<InventoryBalance> balances = balanceRepository.lockSellableByProductFefo(line.productId(), today);
        int available = balances.stream().mapToInt(InventoryBalance::getAvailable).sum();
        if (available < line.quantity()) {
            throw new ConflictException("Sản phẩm " + line.productId() + " chỉ còn " + available
                    + " có thể bán, không đủ " + line.quantity());
        }

        List<StockReservation> reservations = new ArrayList<>();
        int remaining = line.quantity();
        for (InventoryBalance balance : balances) {
            if (remaining == 0) {
                break;
            }
            int take = Math.min(remaining, balance.getAvailable());
            balance.reserve(take);
            reservations.add(new StockReservation(line.orderItemId(), balance.getBatch(), take));
            remaining -= take;
        }
        return reservations;
    }
}
