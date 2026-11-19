package com.aquaflow.delivery.application;

import com.aquaflow.delivery.api.DeliveryDtos.*;
import com.aquaflow.delivery.repository.DeliveryRepository;
import com.aquaflow.delivery.repository.DeliveryRepository.TripRow;
import com.aquaflow.delivery.repository.VehicleRepository;
import com.aquaflow.customer.order.api.dto.DispatchResponse;
import com.aquaflow.customer.order.repository.OrderItemRepository;
import com.aquaflow.customer.order.repository.OrderRepository;
import com.aquaflow.inventory.application.RedeliveryReservationService;
import com.aquaflow.inventory.application.ReservationLine;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;

/** Trip assignments, inventory dispatch and delivery outcomes share one trip workflow. */
@Service
@Transactional(readOnly = true)
public class DeliveryService {
    private final DeliveryRepository repository;
    private final AssignmentDispatchService assignmentDispatch;
    private final RedeliveryReservationService redeliveryReservations;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final DeliveryBottleService bottleLedger;
    private final VehicleRepository vehicles;
    private final Clock clock;

    /** Giới hạn của bộ lọc "chuyến gần đây". */
    public static final int MAX_RECENT_DAYS = 365;

    public DeliveryService(DeliveryRepository repository, AssignmentDispatchService assignmentDispatch,
                          RedeliveryReservationService redeliveryReservations,
                          OrderRepository orderRepository, OrderItemRepository orderItemRepository, DeliveryBottleService bottleLedger,
                          VehicleRepository vehicles, Clock clock) {
        this.repository = repository;
        this.assignmentDispatch = assignmentDispatch;
        this.redeliveryReservations = redeliveryReservations;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.bottleLedger = bottleLedger;
        this.vehicles = vehicles;
        this.clock = clock;
    }

    public List<TripResponse> list(long actorId, boolean admin) {
        return list(actorId, admin, null, null);
    }

    /**
     * @param orderId chỉ chuyến có đơn này
     * @param days    chỉ chuyến chưa xong hoặc có hoạt động trong số ngày này (1–365); null: mọi chuyến
     */
    public List<TripResponse> list(long actorId, boolean admin, Long orderId, Integer days) {
        if (orderId != null && orderId <= 0) throw new BadRequestException("Mã đơn không hợp lệ");
        if (days != null && (days < 1 || days > MAX_RECENT_DAYS))
            throw new BadRequestException("Số ngày phải từ 1 đến " + MAX_RECENT_DAYS);
        OffsetDateTime since = days == null ? null : OffsetDateTime.now(clock).minusDays(days);
        return repository.viewTrips(repository.listTrips(actorId, admin, orderId, since));
    }

    public TripResponse get(long id, long actorId, boolean admin) {
        TripRow trip = repository.findTrip(id);
        requireVisible(trip, actorId, admin);
        return repository.viewTrip(trip);
    }

    /** Tài xế đang hoạt động, kèm chuyến đang giữ họ (nếu có) để màn hình xếp chuyến biết ai đang bận. */
    public List<DriverResponse> drivers(boolean admin) {
        requireStoreStaff(admin);
        var busy = vehicles.busyTripByDriver();
        return repository.drivers().stream()
                .map(driver -> new DriverResponse(driver.id(), driver.name(), busy.get(driver.id()))).toList();
    }

    public List<AvailableOrderResponse> availableOrders(boolean admin) {
        requireStoreStaff(admin);
        return repository.availableOrders();
    }

    public List<AttemptResponse> attempts(long tripId, long orderId, long actorId, boolean admin) {
        TripResponse trip = get(tripId, actorId, admin);
        if (trip.orders().stream().noneMatch(o -> o.orderId() == orderId)) {
            throw new com.aquaflow.shared.api.NotFoundException("Đơn không thuộc chuyến");
        }
        return repository.attempts(tripId, orderId);
    }

    @Transactional
    public TripResponse cancel(long id, long actorId, boolean admin) {
        requireStoreStaff(admin);
        TripRow trip = repository.lockTrip(id);
        if ("CANCELLED".equals(trip.status())) return repository.viewTrip(trip);
        requireStatus(trip, "CREATED");
        for (Long orderId : repository.assignedOrders(id)) {
            var order = repository.lockOrder(orderId);
            if ("OUT_FOR_DELIVERY".equals(order.status()) && repository.hasDispatch(orderId)) {
                throw new ConflictException("Không thể hủy chuyến sau khi đã xuất kho; hãy khởi hành và ghi nhận kết quả giao");
            }
            rollbackPreparedRedelivery(orderId);
        }
        repository.cancelTrip(id);
        return repository.viewTrip(repository.findTrip(id));
    }

    @Transactional
    public TripResponse create(CreateTripRequest request, long actorId, boolean admin) {
        requireStoreStaff(admin);
        String driverName = null;
        if (request.driverId() != null) {
            driverName = requireActiveDriver(request.driverId());
            requireDriverFree(request.driverId(), driverName, null);
        }
        String plate = DeliveryRepository.clean(request.vehicle());
        if (request.vehicleId() != null) {
            var vehicle = vehicles.lock(request.vehicleId());
            if (!vehicle.active()) throw new ConflictException("Xe " + vehicle.plate() + " đã ngừng sử dụng");
            vehicles.vehicleBusy(vehicle.id(), null).ifPresent(busy -> {
                throw new ConflictException("Xe " + vehicle.plate() + " đang ở chuyến #" + busy.tripId() + " " + statusText(busy.status()));
            });
            plate = vehicle.plate();
        }
        Long id = repository.createTrip(actorId, request.driverId(), driverName, plate, request.vehicleId());
        return repository.viewTrip(repository.findTrip(id));
    }

    @Transactional
    public TripResponse assignDriver(long tripId, AssignDriverRequest request, long actorId, boolean admin) {
        requireStoreStaff(admin);
        TripRow trip = repository.lockTrip(tripId);
        requireStatus(trip, "CREATED");
        String name = requireActiveDriver(request.driverId());
        requireDriverFree(request.driverId(), name, tripId);
        repository.assignDriver(tripId, request.driverId(), name);
        return repository.viewTrip(repository.findTrip(tripId));
    }

    @Transactional
    public TripResponse addOrder(long tripId, AddOrderRequest request, long actorId, boolean admin) {
        requireStoreStaff(admin);
        TripRow trip = repository.lockTrip(tripId);
        requireStatus(trip, "CREATED");

        // This also serializes assignments to the same order from other trips.
        var order = repository.lockOrder(request.orderId());
        if (repository.isAssigned(order.id())) {
            throw new ConflictException("Đơn đã thuộc một chuyến khác");
        }
        if (request.redelivery()) {
            if (!"DELIVERY".equals(order.fulfillmentType()) || !"CANCELLED".equals(order.status())
                    || !order.deliveryFailed() || !repository.hasDispatch(order.id())) {
                throw new ConflictException("Chỉ đơn giao thất bại đã kiểm nhận hàng trả mới được giao lại");
            }
            var managedOrder = orderRepository.findForUpdateById(order.id())
                    .orElseThrow(() -> new com.aquaflow.shared.api.NotFoundException("Không tìm thấy đơn hàng"));
            var lines = orderItemRepository.findAllByOrder_Id(order.id()).stream()
                    .map(item -> new ReservationLine(item.getId(), item.getProductId(), item.getQuantity())).toList();
            if (lines.isEmpty()) throw new ConflictException("Đơn không có dòng hàng để giao lại");
            redeliveryReservations.reserve(lines);
            managedOrder.prepareForRedelivery();
            orderRepository.flush();
        } else if (!"DELIVERY".equals(order.fulfillmentType()) || !"PREPARING".equals(order.status())
                || order.deliveryFailed() || repository.hasDispatch(order.id())) {
            throw new ConflictException("Chỉ được thêm đơn DELIVERY đang PREPARING vào chuyến");
        }
        requireCapacity(trip, order.id());
        repository.addOrder(tripId, order.id());
        return repository.viewTrip(repository.findTrip(tripId));
    }

    /** Dispatches each active assignment through its own transaction. */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public TripResponse dispatch(long tripId, long actorId, boolean admin) {
        requireStoreStaff(admin);
        List<Long> orderIds = repository.assignedOrders(tripId);
        if (orderIds.isEmpty()) throw new ConflictException("Chuyến chưa có đơn hàng");
        for (Long orderId : orderIds) {
            assignmentDispatch.dispatchFromTrip(tripId, orderId, actorId, admin);
        }
        return repository.viewTrip(repository.findTrip(tripId));
    }

    /** Dispatch only the exact active assignment; other orders on the trip remain independent. */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public DispatchResponse dispatchAssignment(long tripId, long orderId, long actorId, boolean admin) {
        return assignmentDispatch.dispatch(tripId, orderId, actorId, admin);
    }

    @Transactional
    public TripResponse removeOrder(long tripId, long orderId, long actorId, boolean admin) {
        requireStoreStaff(admin);
        TripRow trip = repository.lockTrip(tripId);
        requireStatus(trip, "CREATED");
        repository.activeAssignment(tripId, orderId);
        var order = repository.lockOrder(orderId);
        if ("OUT_FOR_DELIVERY".equals(order.status()) && repository.hasDispatch(orderId)) {
            throw new ConflictException("Không thể bỏ đơn khỏi chuyến sau khi đã xuất kho");
        }
        rollbackPreparedRedelivery(orderId);
        repository.removeOrder(tripId, orderId);
        return repository.viewTrip(repository.findTrip(tripId));
    }

    @Transactional
    public TripResponse start(long tripId, long actorId, boolean admin) {
        TripRow trip = repository.lockTrip(tripId);
        requireVisible(trip, actorId, admin);
        if ("IN_PROGRESS".equals(trip.status())) return repository.viewTrip(trip);
        requireStatus(trip, "CREATED");
        if (trip.driverId() == null) throw new ConflictException("Chưa phân công tài xế");
        requireActiveDriver(trip.driverId());
        List<Long> orderIds = repository.assignedOrders(tripId);
        if (orderIds.isEmpty()) throw new ConflictException("Chuyến chưa có đơn hàng");
        for (Long orderId : orderIds) {
            var order = repository.lockOrder(orderId);
            if (!"DELIVERY".equals(order.fulfillmentType()) || !"OUT_FOR_DELIVERY".equals(order.status())
                    || !repository.hasDispatch(orderId)) {
                throw new ConflictException("Đơn " + orderId + " không còn đủ điều kiện lên chuyến");
            }
            repository.createLoadManifest(tripId, orderId);
            bottleLedger.capture(tripId,orderId);
        }
        repository.startTrip(tripId);
        return repository.viewTrip(repository.findTrip(tripId));
    }

    @Transactional
    public TripResponse recordResult(long tripId, long orderId, DeliveryResultRequest request,
                                     long actorId, boolean admin) {
        TripRow trip = repository.lockTrip(tripId);
        requireVisible(trip, actorId, admin);
        requireStatus(trip, "IN_PROGRESS");
        var assignment = repository.activeAssignment(tripId, orderId);
        if (repository.latestOutcome(assignment.id()).isPresent()) {
            throw new ConflictException("Lần phân công đã có kết quả. Giao lại phải qua kiểm nhận hàng hoàn và phân công mới");
        }
        if (request.outcome() == Outcome.SUCCESS) {
            if (DeliveryRepository.clean(request.recipientName()) == null) {
                throw new BadRequestException("Cần nhập tên người nhận thực tế");
            }
            if (DeliveryRepository.clean(request.failureReason()) != null) {
                throw new BadRequestException("Giao thành công không được kèm lý do thất bại");
            }
            repository.recordSuccess(orderId, assignment.id());
            bottleLedger.give(assignment.id(),orderId,actorId);
        } else {
            if (DeliveryRepository.clean(request.failureReason()) == null) {
                throw new BadRequestException("Cần ghi lý do giao hàng thất bại");
            }
            repository.recordFailure(orderId);
        }
        repository.addAttempt(assignment.id(), repository.nextAttemptNo(assignment.id()), request);
        return repository.viewTrip(repository.findTrip(tripId));
    }

    @Transactional
    public TripResponse settle(long tripId, SettleTripRequest request, long actorId, boolean admin) {
        requireStoreStaff(admin);
        TripRow trip = repository.lockTrip(tripId);
        requireStatus(trip, "IN_PROGRESS");
        if (trip.driverId() == null) throw new ConflictException("Chuyến chưa có tài xế");
        if (!repository.allOrdersHaveResult(tripId)) {
            throw new ConflictException("Vẫn còn đơn chưa ghi nhận kết quả giao");
        }
        var collections = repository.collections(tripId);
        if (!collections.receipts().isEmpty() && (request.cashReported().compareTo(collections.cashExpected()) != 0
                || request.bottlesExpected() != collections.bottlesExpected()
                || request.depositReported().compareTo(collections.depositExpected()) != 0)) {
            throw new ConflictException("Collection totals changed; reload the trip before settlement");
        }
        if ((request.cashReported().compareTo(request.cashConfirmed()) != 0
                || !request.bottlesExpected().equals(request.bottlesConfirmed())
                || request.depositReported().compareTo(request.depositConfirmed()) != 0)
                && DeliveryRepository.clean(request.note()) == null) {
            throw new BadRequestException("Cần ghi lý do khi tiền hoặc vỏ bàn giao có chênh lệch");
        }
        // Only records the physical handover; it does NOT create a payment/refund or restock.
        repository.settleTrip(tripId, actorId, trip.driverId(), request);
        return repository.viewTrip(repository.findTrip(tripId));
    }

    /** Tài xế đang ở chuyến khác chưa xuất phát hoặc chưa giao xong thì không xếp thêm. */
    private void requireDriverFree(long driverId, String name, Long tripId) {
        vehicles.lockDriver(driverId);
        vehicles.driverBusy(driverId, tripId).ifPresent(busy -> {
            throw new ConflictException("Tài xế " + name + " đang ở chuyến #" + busy.tripId() + " " + statusText(busy.status()));
        });
    }

    /** Chuyến có xe trong danh mục: tổng số kiện không được vượt sức chở. */
    private void requireCapacity(TripRow trip, long orderId) {
        if (trip.vehicleId() == null || trip.vehicleCapacity() == null) return;
        int loaded = vehicles.tripUnits(trip.id());
        var order = vehicles.orderLoad(orderId);
        int over = loaded + order.units() - trip.vehicleCapacity();
        if (over > 0)
            throw new ConflictException("Xe " + trip.vehicle() + " chở tối đa " + trip.vehicleCapacity() + " kiện; chuyến đã có "
                    + loaded + " kiện, đơn " + order.orderCode() + " thêm " + order.units() + " kiện, vượt " + over + " kiện");
    }

    private static String statusText(String status) {
        return "CREATED".equals(status) ? "(chờ xuất phát)" : "(đang giao)";
    }

    private String requireActiveDriver(long driverId) {
        return repository.activeDriverName(driverId).orElseThrow(() ->
                new BadRequestException("Tài xế không tồn tại, không hoạt động hoặc không có role DELIVERY_STAFF"));
    }

    private void rollbackPreparedRedelivery(long orderId) {
        var order = repository.lockOrder(orderId);
        if (!"PREPARING".equals(order.status()) || !order.deliveryFailed() || !repository.hasDispatch(orderId)) return;
        var managedOrder = orderRepository.findForUpdateById(orderId)
                .orElseThrow(() -> new com.aquaflow.shared.api.NotFoundException("Không tìm thấy đơn hàng"));
        var lines = orderItemRepository.findAllByOrder_Id(orderId).stream()
                .map(item -> new ReservationLine(item.getId(), item.getProductId(), item.getQuantity())).toList();
        redeliveryReservations.releaseBeforeDispatch(lines);
        managedOrder.cancelPreparedRedelivery();
        orderRepository.flush();
    }

    public CollectionsResponse collections(long tripId, long actorId, boolean storeStaff) {
        requireVisible(repository.findTrip(tripId), actorId, storeStaff);
        return repository.collections(tripId);
    }

    @Transactional
    public CollectionsResponse collect(long tripId, long orderId, CollectionRequest request, long actorId, boolean storeStaff) {
        var trip = repository.lockTrip(tripId);
        requireVisible(trip, actorId, storeStaff);
        // Find the assignment before any writes; another driver's order is never accepted.
        var assignment = repository.activeAssignment(tripId, orderId);
        if (repository.collectionExists(assignment.id(), request)) return repository.collections(tripId);
        if(request.bottlesReturned()>0) throw new BadRequestException("Vui lòng ghi nhận thu vỏ theo từng loại tại mục Vỏ của đơn");
        requireStatus(trip, "IN_PROGRESS");
        var order = repository.lockOrder(orderId);
        if (!List.of("OUT_FOR_DELIVERY", "DELIVERED").contains(order.status())) throw new ConflictException("Order cannot receive collections");
        if (request.amount().signum()==0 && request.bottlesReturned()==0 && request.depositAmount().signum()==0)
            throw new BadRequestException("Enter an amount or returned bottles");
        var balance = repository.balance(orderId);
        if (request.amount().compareTo(balance.due())>0) throw new ConflictException("Amount exceeds the outstanding balance");
        int returned = repository.collections(tripId).receipts().stream().filter(r -> r.orderId()==orderId).mapToInt(CollectionResponse::bottlesReturned).sum();
        if ((long)returned+request.bottlesReturned()>balance.bottlesToExchange()) throw new BadRequestException("Returned bottles exceed the order quantity");
        java.util.UUID depositEntry = null;
        if (request.depositAmount().signum()>0) {
            // Cọc chỉ thu cho phần vỏ khách chưa đổi của đơn đã giao thành công, ghi vào sổ cọc của khách.
            if (request.depositAmount().compareTo(bottleLedger.depositShortfall(assignment.id()))>0)
                throw new ConflictException("Tiền cọc vượt số cọc còn phải thu cho số vỏ khách chưa đổi");
            depositEntry = bottleLedger.collectDeposit(assignment.id(), orderId, actorId, request.requestId(), request.depositAmount());
        }
        repository.collect(assignment.id(), orderId, actorId, request, depositEntry);
        return repository.collections(tripId);
    }

    private static void requireStatus(TripRow trip, String expected) {
        if (!expected.equals(trip.status())) {
            throw new ConflictException("Chuyến cần ở trạng thái " + expected + ", hiện tại: " + trip.status());
        }
    }

    private static void requireStoreStaff(boolean admin) {
        if (!admin) throw new AccessDeniedException("Chỉ chủ cửa hàng được thực hiện thao tác này");
    }

    private static void requireVisible(TripRow trip, long actorId, boolean admin) {
        if (!admin && !Long.valueOf(actorId).equals(trip.driverId())) {
            throw new AccessDeniedException("Tài xế chỉ được truy cập chuyến của mình");
        }
    }
}
