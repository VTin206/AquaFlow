package com.aquaflow.delivery.repository;

import com.aquaflow.delivery.api.DeliveryDtos.*;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/** JDBC repository, consistent with the existing DispatchRepository and V1/V6/V9 schema. */
@Repository
public class DeliveryRepository {
    private final JdbcTemplate jdbc;

    public DeliveryRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record TripRow(Long id, Long driverId, String driverName, String vehicle,
                          String status, Long createdBy, OffsetDateTime createdAt,
                          OffsetDateTime startedAt, OffsetDateTime endedAt) {}

    public record OrderRow(Long id, String status, String fulfillmentType, boolean deliveryFailed) {}

    public record AssignmentRow(Long id, Long orderId) {}

    private static final String TRIP_SELECT = """
            SELECT t.id, t.driver_id, COALESCE(u.full_name, t.driver_name) AS driver_name,
                   t.vehicle, t.status, t.created_by, t.created_at, t.started_at, t.ended_at
            FROM delivery_trips t LEFT JOIN users u ON u.id = t.driver_id
            """;

    private static final RowMapper<TripRow> TRIP_MAPPER = (rs, rowNum) -> new TripRow(
            rs.getLong("id"), rs.getObject("driver_id", Long.class),
            rs.getString("driver_name"), rs.getString("vehicle"), rs.getString("status"),
            rs.getLong("created_by"), rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("started_at", OffsetDateTime.class),
            rs.getObject("ended_at", OffsetDateTime.class));

    public TripRow lockTrip(long id) {
        return jdbc.query(TRIP_SELECT + " WHERE t.id = ? FOR UPDATE OF t", TRIP_MAPPER, id)
                .stream().findFirst().orElseThrow(() -> new NotFoundException("Không tìm thấy chuyến giao"));
    }

    public TripRow findTrip(long id) {
        return jdbc.query(TRIP_SELECT + " WHERE t.id = ?", TRIP_MAPPER, id)
                .stream().findFirst().orElseThrow(() -> new NotFoundException("Không tìm thấy chuyến giao"));
    }

    public List<TripRow> listTrips(long userId, boolean admin) {
        return jdbc.query(TRIP_SELECT + " WHERE (? OR t.driver_id = ?) ORDER BY t.id DESC",
                TRIP_MAPPER, admin, userId);
    }

    public Long createTrip(long creatorId, Long driverId, String driverName, String vehicle) {
        return jdbc.queryForObject("""
                INSERT INTO delivery_trips(created_by, driver_id, driver_name, vehicle)
                VALUES (?, ?, ?, ?) RETURNING id
                """, Long.class, creatorId, driverId, driverName, vehicle);
    }

    public List<DriverResponse> drivers() {
        return jdbc.query("""
                SELECT u.id, u.full_name FROM users u JOIN roles r ON r.id = u.role_id
                WHERE u.status = 'ACTIVE' AND r.code = 'DELIVERY_STAFF' ORDER BY u.full_name, u.id
                """, (rs, i) -> new DriverResponse(rs.getLong("id"), rs.getString("full_name")));
    }

    public List<AvailableOrderResponse> availableOrders() {
        return jdbc.query("""
                SELECT o.id, o.order_code, o.recipient_name, o.delivery_address, o.delivery_failed,
                       (o.status = 'CANCELLED' AND o.delivery_failed
                        AND EXISTS (SELECT 1 FROM inventory_returns r WHERE r.order_id = o.id)) AS redelivery_eligible
                FROM orders o WHERE o.fulfillment_type = 'DELIVERY'
                  AND ((o.status = 'PREPARING' AND NOT o.delivery_failed)
                    OR (o.status = 'CANCELLED' AND o.delivery_failed
                        AND EXISTS (SELECT 1 FROM inventory_returns r WHERE r.order_id = o.id)))
                  AND NOT EXISTS (SELECT 1 FROM delivery_assignments a WHERE a.order_id = o.id AND a.active)
                ORDER BY o.created_at, o.id
                """, (rs, i) -> new AvailableOrderResponse(rs.getLong("id"), rs.getString("order_code"),
                rs.getString("recipient_name"), rs.getString("delivery_address"), rs.getBoolean("delivery_failed"),
                rs.getBoolean("redelivery_eligible")));
    }

    public void cancelTrip(long id) {
        jdbc.update("UPDATE delivery_trips SET status = 'CANCELLED', ended_at = NOW() WHERE id = ?", id);
        releaseAssignments(id);
    }

    private void releaseAssignments(long tripId) {
        jdbc.update("UPDATE delivery_assignments SET active = FALSE WHERE trip_id = ?", tripId);
    }

    public List<AttemptResponse> attempts(long tripId, long orderId) {
        return jdbc.query("""
                SELECT da.id AS attempt_id, da.attempt_no, da.outcome, da.recipient_name AS actual_recipient,
                       da.failure_reason, da.note AS attempt_note, da.attempted_at
                FROM delivery_attempts da JOIN delivery_assignments a ON a.id = da.assignment_id
                WHERE a.trip_id = ? AND a.order_id = ? ORDER BY da.attempt_no DESC, da.id DESC
                """, (rs, i) -> mapAttempt(rs), tripId, orderId);
    }

    /** Attempt history for the exact assignment addressed by the assignment REST resource. */
    public List<AttemptResponse> attemptsForAssignment(long assignmentId) {
        return jdbc.query("""
                SELECT da.id AS attempt_id, da.attempt_no, da.outcome, da.recipient_name AS actual_recipient,
                       da.failure_reason, da.note AS attempt_note, da.attempted_at
                FROM delivery_attempts da
                WHERE da.assignment_id = ? ORDER BY da.attempt_no DESC, da.id DESC
                """, (rs, i) -> mapAttempt(rs), assignmentId);
    }

    /**
     * Prefer the immutable load manifest captured for this assignment. Looking up the latest order dispatch
     * alone is incorrect after redelivery because it makes an older trip display the newer dispatch lots.
     * Before a trip starts its manifest does not exist yet, so use the latest dispatch as the pending-load view.
     */
    private List<LoadLineResponse> orderLoad(long assignmentId, long orderId) {
        List<LoadLineResponse> manifest = jdbc.query("""
                SELECT b.product_id, p.name, p.unit, b.lot_code, l.quantity_loaded AS quantity
                FROM delivery_load_items l
                JOIN product_batches b ON b.id = l.batch_id
                JOIN products p ON p.id = b.product_id
                WHERE l.assignment_id = ?
                ORDER BY b.product_id, b.expires_on, b.id, l.id
                """, (rs, i) -> new LoadLineResponse(rs.getLong("product_id"), rs.getString("name"),
                rs.getString("unit"), rs.getString("lot_code"), rs.getInt("quantity")), assignmentId);
        if (!manifest.isEmpty()) {
            return manifest;
        }
        return jdbc.query("""
                SELECT di.product_id, p.name, p.unit, di.lot_code, di.quantity
                FROM order_dispatch_items di JOIN order_dispatches d ON d.id = di.dispatch_id
                JOIN products p ON p.id = di.product_id
                WHERE d.id = (SELECT id FROM order_dispatches WHERE order_id = ? ORDER BY dispatched_at DESC, id DESC LIMIT 1)
                  AND EXISTS (
                      SELECT 1 FROM delivery_assignments a
                      JOIN delivery_trips t ON t.id = a.trip_id
                      JOIN orders o ON o.id = a.order_id
                      WHERE a.id = ? AND a.order_id = ? AND a.active
                        AND t.status = 'CREATED' AND o.status = 'OUT_FOR_DELIVERY'
                  )
                ORDER BY di.id
                """, (rs, i) -> new LoadLineResponse(rs.getLong("product_id"), rs.getString("name"),
                rs.getString("unit"), rs.getString("lot_code"), rs.getInt("quantity")), orderId, assignmentId, orderId);
    }


    public Optional<String> activeDriverName(long driverId) {
        return jdbc.query("""
                SELECT u.full_name FROM users u JOIN roles r ON r.id = u.role_id
                WHERE u.id = ? AND u.status = 'ACTIVE' AND r.code = 'DELIVERY_STAFF'
                """, (rs, i) -> rs.getString(1), driverId).stream().findFirst();
    }

    public void assignDriver(long tripId, long driverId, String name) {
        jdbc.update("UPDATE delivery_trips SET driver_id = ?, driver_name = ? WHERE id = ?",
                driverId, name, tripId);
    }

    public OrderRow lockOrder(long orderId) {
        return jdbc.query("SELECT id, status, fulfillment_type, delivery_failed FROM orders WHERE id = ? FOR UPDATE",
                (rs, i) -> new OrderRow(rs.getLong("id"), rs.getString("status"),
                        rs.getString("fulfillment_type"), rs.getBoolean("delivery_failed")), orderId)
                .stream().findFirst().orElseThrow(() -> new NotFoundException("Không tìm thấy đơn hàng"));
    }

    public boolean hasDispatch(long orderId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM order_dispatches WHERE order_id = ?)", Boolean.class, orderId));
    }

    public record AssignmentContext(long id, long tripId, long orderId, boolean active) {}

    public AssignmentContext assignment(long id) {
        return jdbc.query("SELECT id, trip_id, order_id, active FROM delivery_assignments WHERE id = ?",
                (rs, n) -> new AssignmentContext(rs.getLong("id"), rs.getLong("trip_id"), rs.getLong("order_id"), rs.getBoolean("active")), id)
                .stream().findFirst().orElseThrow(() -> new NotFoundException("Không tìm thấy phân công giao hàng"));
    }

    public AssignmentContext assignmentForAttempt(long id) {
        Long assignmentId = jdbc.query("SELECT assignment_id FROM delivery_attempts WHERE id = ?",
                (rs, n) -> rs.getLong(1), id).stream().findFirst()
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lần giao"));
        return assignment(assignmentId);
    }

    public boolean isAssigned(long orderId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM delivery_assignments WHERE order_id = ? AND active)",
                Boolean.class, orderId));
    }

    /** Lock a valid dispatch assignment before the order/stock rows are locked by the dispatch service. */
    public Long lockDispatchableTripForOrder(long orderId) {
        List<Long> tripIds = jdbc.query("""
                SELECT t.id
                FROM delivery_assignments a
                JOIN delivery_trips t ON t.id = a.trip_id
                JOIN users u ON u.id = t.driver_id
                JOIN roles r ON r.id = u.role_id
                WHERE a.order_id = ? AND a.active
                  AND t.status = 'CREATED'
                  AND u.status = 'ACTIVE' AND r.code = 'DELIVERY_STAFF'
                ORDER BY a.id
                LIMIT 2
                FOR UPDATE OF t, a
                """, (rs, row) -> rs.getLong("id"), orderId);
        if (tripIds.size() != 1) {
            throw new ConflictException("Đơn DELIVERY phải thuộc một Assignment đang hoạt động trong Trip CREATED có tài xế hợp lệ");
        }
        return tripIds.getFirst();
    }

    /** The trip dispatch path must dispatch the exact active assignment it already locked. */
    public void lockDispatchableAssignment(long tripId, long orderId) {
        boolean valid = !jdbc.query("""
                SELECT t.id
                FROM delivery_assignments a
                JOIN delivery_trips t ON t.id = a.trip_id
                JOIN users u ON u.id = t.driver_id
                JOIN roles r ON r.id = u.role_id
                WHERE a.trip_id = ? AND a.order_id = ? AND a.active
                  AND t.status = 'CREATED'
                  AND u.status = 'ACTIVE' AND r.code = 'DELIVERY_STAFF'
                FOR UPDATE OF t, a
                """, (rs, row) -> rs.getLong("id"), tripId, orderId).isEmpty();
        if (!valid) {
            throw new ConflictException("Assignment không còn hoạt động hoặc Trip/tài xế không hợp lệ để Dispatch");
        }
    }

    public void addOrder(long tripId, long orderId) {
        jdbc.update("INSERT INTO delivery_assignments(trip_id, order_id) VALUES (?, ?)", tripId, orderId);
    }

    public AssignmentRow activeAssignment(long tripId, long orderId) {
        return jdbc.query("""
                SELECT id, order_id FROM delivery_assignments
                WHERE trip_id = ? AND order_id = ? AND active
                """, (rs, i) -> new AssignmentRow(rs.getLong("id"), rs.getLong("order_id")), tripId, orderId)
                .stream().findFirst().orElseThrow(() -> new NotFoundException("Đơn không thuộc chuyến"));
    }

    public void removeOrder(long tripId, long orderId) {
        int removed = jdbc.update("""
                DELETE FROM delivery_assignments
                WHERE trip_id = ? AND order_id = ? AND active
                """, tripId, orderId);
        if (removed == 0) throw new NotFoundException("Đơn không thuộc chuyến");
    }

    public List<Long> assignedOrders(long tripId) {
        return jdbc.query("""
                SELECT order_id FROM delivery_assignments
                WHERE trip_id = ? AND active ORDER BY order_id
                """, (rs, i) -> rs.getLong(1), tripId);
    }

    /** Populate the manifest from already-dispatched stock; never dispatch stock a second time. */
    public void createLoadManifest(long tripId, long orderId) {
        int inserted = jdbc.update("""
                INSERT INTO delivery_load_items(assignment_id, order_item_id, batch_id, quantity_loaded)
                SELECT a.id, di.order_item_id, di.batch_id, di.quantity
                FROM delivery_assignments a
                JOIN order_dispatches d ON d.id = (
                    SELECT latest.id FROM order_dispatches latest WHERE latest.order_id = a.order_id
                    ORDER BY latest.dispatched_at DESC, latest.id DESC LIMIT 1)
                JOIN order_dispatch_items di ON di.dispatch_id = d.id
                WHERE a.trip_id = ? AND a.order_id = ? AND a.active
                """, tripId, orderId);
        if (inserted == 0) throw new ConflictException("Đơn chưa có chi tiết xuất kho");
    }

    public void startTrip(long tripId) {
        jdbc.update("""
                UPDATE delivery_trips SET status = 'IN_PROGRESS', started_at = NOW()
                WHERE id = ?
                """, tripId);
    }

    public Optional<Outcome> latestOutcome(long assignmentId) {
        return jdbc.query("""
                SELECT outcome FROM delivery_attempts WHERE assignment_id = ?
                ORDER BY attempt_no DESC LIMIT 1
                """, (rs, i) -> Outcome.valueOf(rs.getString(1)), assignmentId)
                .stream().findFirst();
    }

    public int nextAttemptNo(long assignmentId) {
        return jdbc.queryForObject("""
                SELECT COALESCE(MAX(attempt_no), 0) + 1 FROM delivery_attempts WHERE assignment_id = ?
                """, Integer.class, assignmentId);
    }

    public void addAttempt(long assignmentId, int number, DeliveryResultRequest request) {
        jdbc.update("""
                INSERT INTO delivery_attempts(assignment_id, attempt_no, outcome, recipient_name,
                                              failure_reason, note)
                VALUES (?, ?, ?, ?, ?, ?)
                """, assignmentId, number, request.outcome().name(),
                clean(request.recipientName()), clean(request.failureReason()), clean(request.note()));
    }

    public void recordSuccess(long orderId, long assignmentId) {
        int updated = jdbc.update("""
                UPDATE orders SET status = 'DELIVERED', delivered_at = NOW(), delivery_failed = FALSE
                WHERE id = ? AND status = 'OUT_FOR_DELIVERY'
                """, orderId);
        if (updated != 1) throw new ConflictException("Đơn không ở trạng thái đang giao");
        jdbc.update("""
                UPDATE delivery_load_items SET quantity_delivered = quantity_loaded
                WHERE assignment_id = ?
                """, assignmentId);
    }

    public void recordFailure(long orderId) {
        int updated = jdbc.update("""
                UPDATE orders SET delivery_failed = TRUE
                WHERE id = ? AND status = 'OUT_FOR_DELIVERY'
                """, orderId);
        if (updated != 1) throw new ConflictException("Đơn không ở trạng thái đang giao");
    }

    public boolean allOrdersHaveResult(long tripId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT NOT EXISTS (
                    SELECT 1 FROM delivery_assignments a
                    WHERE a.trip_id = ? AND a.active AND NOT EXISTS (
                        SELECT 1 FROM delivery_attempts da WHERE da.assignment_id = a.id
                    )
                )
                """, Boolean.class, tripId));
    }

    public void settleTrip(long tripId, long ownerId, long driverId, SettleTripRequest request) {
        jdbc.update("""
                INSERT INTO handover_records
                    (trip_id, driver_id, received_by, cash_reported, cash_confirmed,
                     bottles_expected, bottles_confirmed, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, tripId, driverId, ownerId, request.cashReported(), request.cashConfirmed(),
                request.bottlesExpected(), request.bottlesConfirmed(), clean(request.note()));
        jdbc.update("""
                UPDATE delivery_trips SET status = 'COMPLETED', ended_at = NOW()
                WHERE id = ?
                """, tripId);
        releaseAssignments(tripId);
    }

    public TripResponse viewTrip(TripRow trip) {
        List<AssignmentResponse> assigned = jdbc.query("""
                SELECT a.id AS assignment_id, o.id AS order_id, o.order_code, o.status AS order_status,
                       o.recipient_name, o.recipient_phone, o.delivery_address, o.requested_delivery_at, o.note,
                       da.id AS attempt_id, da.attempt_no, da.outcome, da.recipient_name AS actual_recipient,
                       da.failure_reason, da.note AS attempt_note, da.attempted_at
                FROM delivery_assignments a JOIN orders o ON o.id = a.order_id
                LEFT JOIN LATERAL (
                    SELECT * FROM delivery_attempts x WHERE x.assignment_id = a.id
                    ORDER BY x.attempt_no DESC LIMIT 1
                ) da ON TRUE
                WHERE a.trip_id = ? ORDER BY a.id
                """, (rs, i) -> new AssignmentResponse(
                rs.getLong("assignment_id"), rs.getLong("order_id"), rs.getString("order_code"),
                rs.getString("order_status"), rs.getString("recipient_name"),
                rs.getString("recipient_phone"), rs.getString("delivery_address"),
                mapAttempt(rs), orderLoad(rs.getLong("assignment_id"), rs.getLong("order_id")),
                rs.getObject("requested_delivery_at", OffsetDateTime.class), rs.getString("note")), trip.id());
        HandoverResponse handover = jdbc.query("""
                SELECT * FROM handover_records WHERE trip_id = ?
                """, (rs, i) -> new HandoverResponse(
                rs.getLong("id"), rs.getBigDecimal("cash_reported"),
                rs.getBigDecimal("cash_confirmed"), rs.getInt("bottles_expected"),
                rs.getInt("bottles_confirmed"), rs.getString("note"),
                rs.getLong("received_by"), rs.getObject("handed_over_at", OffsetDateTime.class)),
                trip.id()).stream().findFirst().orElse(null);
        return new TripResponse(trip.id(), trip.driverId(), trip.driverName(), trip.vehicle(),
                trip.status(), trip.createdAt(), trip.startedAt(), trip.endedAt(),
                trip.createdBy(), assigned, handover);
    }

    private static AttemptResponse mapAttempt(ResultSet rs) throws SQLException {
        Long id = rs.getObject("attempt_id", Long.class);
        if (id == null) return null;
        return new AttemptResponse(id, rs.getInt("attempt_no"),
                Outcome.valueOf(rs.getString("outcome")), rs.getString("actual_recipient"),
                rs.getString("failure_reason"), rs.getString("attempt_note"),
                rs.getObject("attempted_at", OffsetDateTime.class));
    }

    public static String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public CollectionsResponse collections(long tripId) {
        var receipts = jdbc.query("""
                SELECT c.*, a.order_id FROM delivery_collections c
                JOIN delivery_assignments a ON a.id=c.assignment_id WHERE a.trip_id=? ORDER BY c.id
                """, (rs, i) -> new CollectionResponse(rs.getLong("id"), rs.getLong("order_id"),
                rs.getBigDecimal("amount"), rs.getString("method"), rs.getInt("bottles_returned"),
                rs.getLong("recorded_by"), rs.getObject("created_at", OffsetDateTime.class)), tripId);
        var balances = jdbc.query("SELECT order_id FROM delivery_assignments WHERE trip_id=? ORDER BY id",
                (rs, i) -> balance(rs.getLong(1)), tripId);
        BigDecimal cash = receipts.stream().filter(r -> r.method().equals("CASH"))
                .map(CollectionResponse::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new CollectionsResponse(receipts, balances, cash, receipts.stream().mapToInt(CollectionResponse::bottlesReturned).sum());
    }

    public OrderBalance balance(long orderId) {
        return jdbc.queryForObject("""
                SELECT o.id, o.subtotal-o.discount_amount+o.delivery_fee AS total,
                  COALESCE((SELECT SUM(CASE WHEN p.direction='IN' THEN p.amount ELSE -p.amount END)
                    FROM payments p WHERE p.order_id=o.id AND p.status='CONFIRMED'),0) AS paid,
                  COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN products pr ON pr.id=oi.product_id
                    WHERE oi.order_id=o.id AND pr.bottle_type_id IS NOT NULL),0) AS bottles
                FROM orders o WHERE o.id=?
                """, (rs, i) -> new OrderBalance(rs.getLong("id"), rs.getBigDecimal("total"), rs.getBigDecimal("paid"),
                rs.getBigDecimal("total").subtract(rs.getBigDecimal("paid")).max(BigDecimal.ZERO), rs.getInt("bottles")), orderId);
    }

    public boolean collectionExists(long assignmentId, CollectionRequest request) {
        var rows = jdbc.queryForList("SELECT * FROM delivery_collections WHERE request_id=?", request.requestId());
        if (rows.isEmpty()) return false;
        var row = rows.getFirst();
        if (((Number) row.get("assignment_id")).longValue()!=assignmentId
                || ((BigDecimal) row.get("amount")).compareTo(request.amount())!=0
                || !row.get("method").equals(request.method())
                || ((Number) row.get("bottles_returned")).intValue()!=request.bottlesReturned())
            throw new ConflictException("Request id already used with different collection details");
        return true;
    }

    public void collect(long assignmentId, long orderId, long actorId, CollectionRequest request) {
        Long paymentId = null;
        if (request.amount().signum()>0) {
            paymentId = jdbc.queryForObject("""
                    INSERT INTO payments(order_id,direction,method,amount,status,recorded_by,confirmed_by,confirmed_at)
                    VALUES (?,'IN',?,?,'CONFIRMED',?,?,NOW()) RETURNING id
                    """, Long.class, orderId, request.method(), request.amount(), actorId, actorId);
            jdbc.update("INSERT INTO payment_allocations(payment_id,allocation_type,amount) VALUES (?,'SALE',?)", paymentId, request.amount());
        }
        jdbc.update("""
                INSERT INTO delivery_collections(assignment_id,payment_id,request_id,amount,method,bottles_returned,recorded_by)
                VALUES (?,?,?,?,?,?,?)
                """, assignmentId, paymentId, request.requestId(), request.amount(), request.method(), request.bottlesReturned(), actorId);
        var balance = balance(orderId);
        jdbc.update("UPDATE orders SET payment_status=? WHERE id=?",
                balance.due().signum()==0 ? "PAID" : balance.paid().signum()>0 ? "PARTIALLY_PAID" : "UNPAID", orderId);
    }
}
