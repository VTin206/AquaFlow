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
        if (!reservationRepository.findByOrderItemIdIn(orderItemIds).isEmpty()) {
            throw new ConflictException("Đơn hàng đã được giữ hàng trước đó");
        }
        return reserveLines(lines);
    }

    /**
     * Giữ hàng nếu mọi sản phẩm đều đủ; thiếu thì không giữ gì và trả false (không ném lỗi, để transaction gọi tới
     * vẫn dùng tiếp được). Dùng cho đơn web tự xác nhận khi đủ hàng.
     */
    @Transactional
    public boolean tryReserve(Collection<ReservationLine> lines) {
        List<Long> orderItemIds = lines.stream().map(ReservationLine::orderItemId).toList();
        if (lines.isEmpty() || !reservationRepository.findByOrderItemIdIn(orderItemIds).isEmpty()) return false;
        LocalDate today = LocalDate.now(clock);
        // Cộng theo sản phẩm (một đơn có thể có hai dòng cùng sản phẩm), khóa theo thứ tự productId như reserveLines.
        var needed = new java.util.TreeMap<Long, Integer>();
        for (ReservationLine line : lines) needed.merge(line.productId(), line.quantity(), Integer::sum);
        for (var entry : needed.entrySet()) {
            int available = balanceRepository.lockSellableByProductFefo(entry.getKey(), today).stream()
                    .mapToInt(InventoryBalance::getAvailable).sum();
            if (available < entry.getValue()) return false;
        }
        reserveLines(lines);
        return true;
    }

    /** Giữ hàng theo FEFO mà không kiểm tra reservation cũ; chỉ RedeliveryReservationService gọi sau khi đã kiểm tra. */
    List<StockReservation> reserveLines(Collection<ReservationLine> lines) {
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
                .sorted(Comparator.comparing((StockReservation r) -> r.getBatch().getProduct().getId())
                        .thenComparing(r -> r.getBatch().getExpiresOn())
                        .thenComparing(r -> r.getBatch().getId()))
                .toList();

        if (reservations.stream().anyMatch(r -> r.getQuantityDispatched() > 0)) {
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

    /**
     * Sửa dòng hàng của đơn đã giữ hàng nhưng chưa xuất kho: nhả hàng rồi xóa bản ghi giữ hàng để xóa được dòng đơn cũ.
     * Đã xuất kho dòng nào thì ném ConflictException như {@link #release}.
     */
    @Transactional
    public void discardForEdit(Collection<Long> orderItemIds) {
        release(orderItemIds);
        reservationRepository.deleteAll(reservationRepository.findByOrderItemIdIn(orderItemIds));
        reservationRepository.flush();
    }

    /** Release only reservations that have never been dispatched; keep completed dispatch history intact. */
    @Transactional
    public void releaseUndispatched(Collection<Long> orderItemIds) {
        List<StockReservation> reservations = reservationRepository.findByOrderItemIdIn(orderItemIds).stream()
                .filter(reservation -> reservation.getQuantityDispatched() == 0)
                .sorted(Comparator.comparing((StockReservation r) -> r.getBatch().getProduct().getId())
                        .thenComparing(r -> r.getBatch().getExpiresOn())
                        .thenComparing(r -> r.getBatch().getId()))
                .toList();
        for (StockReservation reservation : reservations) {
            int released = reservation.releaseOutstanding();
            if (released == 0) continue;
            InventoryBalance balance = balanceRepository.findForUpdateByBatchId(reservation.getBatch().getId())
                    .orElseThrow(() -> new IllegalStateException(
                            "Missing inventory balance for batch " + reservation.getBatch().getId()));
            balance.release(released);
        }
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
