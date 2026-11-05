package com.aquaflow.inventory.application;

import com.aquaflow.inventory.domain.StockReservation;
import com.aquaflow.inventory.repository.RedeliveryEligibilityRepository;
import com.aquaflow.inventory.repository.RedeliveryEligibilityRepository.LoadSummary;
import com.aquaflow.inventory.repository.StockReservationRepository;
import com.aquaflow.shared.api.ConflictException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Giữ hàng mới cho đơn giao lại. Module delivery gọi trong transaction tạo lần giao lại.
 * Reservation và movement của lần xuất trước được giữ nguyên làm lịch sử.
 */
@Service
public class RedeliveryReservationService {

    private final StockReservationService reservationService;
    private final StockReservationRepository reservationRepository;
    private final RedeliveryEligibilityRepository eligibilityRepository;

    public RedeliveryReservationService(
            StockReservationService reservationService,
            StockReservationRepository reservationRepository,
            RedeliveryEligibilityRepository eligibilityRepository) {
        this.reservationService = reservationService;
        this.reservationRepository = reservationRepository;
        this.eligibilityRepository = eligibilityRepository;
    }

    /**
     * Chỉ cho phép khi mọi dòng đã xuất kho, hàng chở đi đã được kiểm nhận về kho hết
     * và không còn reservation đang giữ. Thiếu hàng thì ConflictException, toàn bộ rollback.
     */
    @Transactional
    public List<StockReservation> reserve(Collection<ReservationLine> lines) {
        List<Long> orderItemIds = lines.stream().map(ReservationLine::orderItemId).toList();
        // Khóa reservation cũ trước để hai yêu cầu giao lại cùng đơn không cùng giữ hàng
        List<StockReservation> existing = reservationRepository.findByOrderItemIdIn(orderItemIds);
        Map<Long, LoadSummary> loads = eligibilityRepository.summarize(orderItemIds).stream()
                .collect(Collectors.toMap(LoadSummary::orderItemId, Function.identity()));

        for (Long orderItemId : orderItemIds) {
            List<StockReservation> ofItem = existing.stream()
                    .filter(r -> r.getOrderItemId().equals(orderItemId))
                    .toList();
            if (ofItem.stream().noneMatch(r -> r.getQuantityDispatched() > 0)) {
                throw new ConflictException("Dòng đơn " + orderItemId + " chưa từng xuất kho, không thể giao lại");
            }
            if (ofItem.stream().anyMatch(r -> r.getOutstanding() > 0)) {
                throw new ConflictException("Dòng đơn " + orderItemId + " đang có hàng được giữ cho lần giao khác");
            }
            LoadSummary load = loads.get(orderItemId);
            if (load == null || load.returned() == 0 || load.outside() > 0) {
                throw new ConflictException("Dòng đơn " + orderItemId + " chưa hoàn tất kiểm nhận hàng hoàn");
            }
        }
        return reservationService.reserveLines(lines);
    }

    /** Undo a prepared-but-not-dispatched redelivery while preserving all prior dispatch rows. */
    @Transactional
    public void releaseBeforeDispatch(Collection<ReservationLine> lines) {
        List<Long> orderItemIds = lines.stream().map(ReservationLine::orderItemId).toList();
        List<StockReservation> existing = reservationRepository.findByOrderItemIdIn(orderItemIds);
        Map<Long, LoadSummary> loads = eligibilityRepository.summarize(orderItemIds).stream()
                .collect(Collectors.toMap(LoadSummary::orderItemId, Function.identity()));
        for (Long orderItemId : orderItemIds) {
            List<StockReservation> ofItem = existing.stream()
                    .filter(reservation -> reservation.getOrderItemId().equals(orderItemId)).toList();
            if (ofItem.stream().noneMatch(reservation -> reservation.getQuantityDispatched() > 0)) {
                throw new ConflictException("Không tìm thấy lịch sử xuất kho để hủy giao lại");
            }
            LoadSummary load = loads.get(orderItemId);
            if (load == null || load.returned() == 0 || load.outside() > 0) {
                throw new ConflictException("Hàng hoàn chưa được kiểm nhận đầy đủ");
            }
        }
        reservationService.releaseUndispatched(orderItemIds);
    }
}
