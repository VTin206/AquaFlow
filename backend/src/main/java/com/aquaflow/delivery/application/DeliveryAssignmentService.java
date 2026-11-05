package com.aquaflow.delivery.application;

import com.aquaflow.delivery.api.DeliveryDtos.*;
import com.aquaflow.delivery.repository.DeliveryRepository;
import com.aquaflow.customer.order.application.OrderDispatchService;
import com.aquaflow.customer.order.api.dto.DispatchResponse;
import com.aquaflow.inventory.api.ReturnDtos;
import com.aquaflow.inventory.application.InventoryReturnService;
import com.aquaflow.shared.api.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class DeliveryAssignmentService {
    private final DeliveryRepository repository;
    private final DeliveryService delivery;
    private final OrderDispatchService dispatches;
    private final InventoryReturnService returns;
    public DeliveryAssignmentService(DeliveryRepository repository, DeliveryService delivery,
            OrderDispatchService dispatches, InventoryReturnService returns) {
        this.repository = repository; this.delivery = delivery; this.dispatches = dispatches; this.returns = returns;
    }

    @Transactional
    public DispatchResponse dispatch(long id, long actor, boolean staff) {
        requireStaff(staff);
        var assignment = repository.assignment(id);
        var trip = repository.lockTrip(assignment.tripId());
        assignment = repository.assignment(id);
        if (!assignment.active() || !"CREATED".equals(trip.status())) throw new ConflictException("Phân công không còn chờ xuất kho");
        var order = repository.lockOrder(assignment.orderId());
        if (!"DELIVERY".equals(order.fulfillmentType()) || !"PREPARING".equals(order.status()))
            throw new ConflictException("Chỉ Dispatch đơn DELIVERY đang PREPARING; không được Dispatch trùng");
        return repository.hasDispatch(order.id())
                ? dispatches.createRedeliveryForTrip(order.id(), actor) : dispatches.createForTrip(order.id(), actor);
    }

    public List<AttemptResponse> attempts(long id, long actor, boolean staff) {
        var assignment = repository.assignment(id);
        return delivery.attempts(assignment.tripId(), assignment.orderId(), actor, staff);
    }

    @Transactional
    public AttemptResponse record(long id, DeliveryResultRequest request, long actor, boolean staff) {
        var assignment = repository.assignment(id);
        repository.lockTrip(assignment.tripId());
        assignment = repository.assignment(id);
        if (!assignment.active()) throw new ConflictException("Phân công không còn hoạt động");
        long orderId = assignment.orderId();
        return delivery.recordResult(assignment.tripId(), orderId, request, actor, staff).orders().stream()
                .filter(o -> o.orderId() == orderId).findFirst().orElseThrow().latestAttempt();
    }

    @Transactional
    public ReturnDtos.Inspection inspect(long attemptId, ReturnDtos.AttemptInspection request, long actor, boolean staff) {
        requireStaff(staff);
        var assignment = repository.assignmentForAttempt(attemptId);
        repository.lockTrip(assignment.tripId());
        repository.lockOrder(assignment.orderId());
        var latest = delivery.attempts(assignment.tripId(), assignment.orderId(), actor, true).stream().findFirst()
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lần giao"));
        if (latest.id() != attemptId || latest.outcome() != Outcome.FAILED)
            throw new ConflictException("Chỉ kiểm nhận lần giao thất bại mới nhất của phân công");
        if (returns.pending().stream().noneMatch(p -> p.assignmentId() == assignment.id()))
            throw new ConflictException("Lần giao không còn chờ kiểm nhận hàng hoàn");
        return returns.create(new ReturnDtos.Create(assignment.orderId(), request.lines(), request.note()), actor);
    }

    private void requireStaff(boolean staff) {
        if (!staff) throw new AccessDeniedException("Chỉ nhân viên cửa hàng được thực hiện thao tác này");
    }
}
