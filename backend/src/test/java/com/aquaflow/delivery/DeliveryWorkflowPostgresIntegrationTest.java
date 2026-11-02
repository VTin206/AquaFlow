package com.aquaflow.delivery;

import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.delivery.api.dto.DeliveryAttemptCreateRequest;
import com.aquaflow.delivery.api.dto.DeliveryAttemptResponse;
import com.aquaflow.delivery.api.dto.DeliveryDispatchResponse;
import com.aquaflow.delivery.api.dto.DeliveryRedeliveryResponse;
import com.aquaflow.delivery.api.dto.ReturnInspectionCreateRequest;
import com.aquaflow.delivery.api.dto.ReturnInspectionResponse;
import com.aquaflow.delivery.application.DeliveryAttemptWorkflowService;
import com.aquaflow.delivery.application.DeliveryDispatchService;
import com.aquaflow.delivery.application.RedeliveryWorkflowService;
import com.aquaflow.delivery.application.ReturnInspectionWorkflowService;
import com.aquaflow.delivery.domain.DeliveryAttemptOutcome;
import com.aquaflow.delivery.repository.DeliveryLoadItemRepository;
import com.aquaflow.inventory.application.ReservationLine;
import com.aquaflow.inventory.application.StockReservationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        properties = "app.jwt.secret=test-test-test-test-test-test-test-test"
)
@EnabledIfEnvironmentVariable(
        named = "DB_URL",
        matches = ".+"
)
class DeliveryWorkflowPostgresIntegrationTest {

    private static final int ORDER_QUANTITY = 3;
    private static final int INITIAL_STOCK = 20;

    private static final String SALES_STAFF = "SALES_STAFF";
    private static final String DELIVERY_STAFF = "DELIVERY_STAFF";

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private StockReservationService stockReservationService;

    @Autowired
    private DeliveryDispatchService deliveryDispatchService;

    @Autowired
    private DeliveryAttemptWorkflowService deliveryAttemptWorkflowService;

    @Autowired
    private ReturnInspectionWorkflowService returnInspectionWorkflowService;

    @Autowired
    private RedeliveryWorkflowService redeliveryWorkflowService;

    @Autowired
    private DeliveryLoadItemRepository deliveryLoadItemRepository;

    private Long driverId;
    private Long salesStaffId;
    private Long productId;
    private Long orderId;
    private Long orderItemId;
    private Long batchId;
    private Long firstTripId;
    private Long firstAssignmentId;

    private final List<Long> createdTripIds = new ArrayList<>();

    @BeforeEach
    void setUp() {

        String suffix = UUID.randomUUID()
                .toString()
                .replace("-", "")
                .substring(0, 12);

        Long deliveryRoleId = ensureRole(DELIVERY_STAFF);
        Long salesRoleId = ensureRole(SALES_STAFF);

        driverId = createUser(
                deliveryRoleId,
                "BE3 Delivery Driver",
                "be3-driver-" + suffix + "@test.local");

        salesStaffId = createUser(
                salesRoleId,
                "BE3 Sales Staff",
                "be3-sales-" + suffix + "@test.local");

        productId = jdbc.queryForObject(
                """
                INSERT INTO products (
                    sku,
                    name,
                    unit,
                    sale_price
                )
                VALUES (?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                "BE3-" + suffix,
                "BE3 Integration Product",
                "bottle",
                10000);

        orderId = jdbc.queryForObject(
                """
                INSERT INTO orders (
                    order_code,
                    created_by,
                    channel,
                    fulfillment_type,
                    status,
                    recipient_name,
                    recipient_phone,
                    delivery_address,
                    subtotal
                )
                VALUES (?, ?, 'COUNTER', 'DELIVERY', 'PREPARING',
                        'BE3 Test Customer', '0900000000',
                        '123 BE3 Integration Street', ?)
                RETURNING id
                """,
                Long.class,
                "BE3-ORDER-" + suffix,
                salesStaffId,
                ORDER_QUANTITY * 10000);

        orderItemId = jdbc.queryForObject(
                """
                INSERT INTO order_items (
                    order_id,
                    product_id,
                    quantity,
                    unit_price,
                    line_total
                )
                VALUES (?, ?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                orderId,
                productId,
                ORDER_QUANTITY,
                10000,
                ORDER_QUANTITY * 10000);

        batchId = jdbc.queryForObject(
                """
                INSERT INTO product_batches (
                    product_id,
                    lot_code,
                    expires_on
                )
                VALUES (?, ?, ?)
                RETURNING id
                """,
                Long.class,
                productId,
                "BE3-LOT-" + suffix,
                LocalDate.now().plusDays(90));

        jdbc.update(
                """
                INSERT INTO inventory_balances (
                    batch_id,
                    on_hand,
                    reserved
                )
                VALUES (?, ?, 0)
                """,
                batchId,
                INITIAL_STOCK);

        firstTripId = createTrip();

        firstAssignmentId = jdbc.queryForObject(
                """
                INSERT INTO delivery_assignments (
                    trip_id,
                    order_id,
                    active
                )
                VALUES (?, ?, TRUE)
                RETURNING id
                """,
                Long.class,
                firstTripId,
                orderId);

        // Tạo reservation ban đầu cho đơn hàng.
        stockReservationService.reserve(
                List.of(new ReservationLine(
                        orderItemId,
                        productId,
                        ORDER_QUANTITY)));
    }

    @AfterEach
    void tearDown() {

        if (orderId != null) {

            // Xóa chi tiết kiểm tra hàng hoàn trước.
            jdbc.update(
                    """
                    DELETE FROM return_inspection_lines
                    WHERE inspection_id IN (
                        SELECT inspection.id
                        FROM return_inspections inspection
                        JOIN delivery_attempts attempt
                          ON attempt.id = inspection.attempt_id
                        JOIN delivery_assignments assignment
                          ON assignment.id = attempt.assignment_id
                        WHERE assignment.order_id = ?
                    )
                    """,
                    orderId);

            jdbc.update(
                    """
                    DELETE FROM return_inspections
                    WHERE attempt_id IN (
                        SELECT attempt.id
                        FROM delivery_attempts attempt
                        JOIN delivery_assignments assignment
                          ON assignment.id = attempt.assignment_id
                        WHERE assignment.order_id = ?
                    )
                    """,
                    orderId);

            jdbc.update(
                    """
                    DELETE FROM delivery_attempts
                    WHERE assignment_id IN (
                        SELECT id
                        FROM delivery_assignments
                        WHERE order_id = ?
                    )
                    """,
                    orderId);

            jdbc.update(
                    """
                    DELETE FROM delivery_load_items
                    WHERE assignment_id IN (
                        SELECT id
                        FROM delivery_assignments
                        WHERE order_id = ?
                    )
                    """,
                    orderId);

            jdbc.update(
                    "DELETE FROM delivery_assignments WHERE order_id = ?",
                    orderId);

            // Inventory movements tham chiếu đến đơn hàng.
            jdbc.update(
                    """
                    DELETE FROM inventory_movements
                    WHERE reference_type = 'ORDER'
                      AND reference_id = ?
                    """,
                    orderId);

            // Xóa reservation trước order_items và product_batches.
            jdbc.update(
                    """
                    DELETE FROM stock_reservations
                    WHERE order_item_id IN (
                        SELECT id
                        FROM order_items
                        WHERE order_id = ?
                    )
                    """,
                    orderId);

            jdbc.update(
                    "DELETE FROM order_items WHERE order_id = ?",
                    orderId);

            jdbc.update(
                    "DELETE FROM orders WHERE id = ?",
                    orderId);
        }

        for (Long tripId : createdTripIds) {
            jdbc.update(
                    "DELETE FROM delivery_trips WHERE id = ?",
                    tripId);
        }

        if (productId != null) {

            jdbc.update(
                    """
                    DELETE FROM inventory_balances
                    WHERE batch_id IN (
                        SELECT id
                        FROM product_batches
                        WHERE product_id = ?
                    )
                    """,
                    productId);

            jdbc.update(
                    "DELETE FROM product_batches WHERE product_id = ?",
                    productId);

            jdbc.update(
                    "DELETE FROM products WHERE id = ?",
                    productId);
        }

        if (driverId != null) {
            jdbc.update(
                    "DELETE FROM users WHERE id = ?",
                    driverId);
        }

        if (salesStaffId != null) {
            jdbc.update(
                    "DELETE FROM users WHERE id = ?",
                    salesStaffId);
        }
    }

    @Test
    void successfulDeliveryMovesOrderToDeliveredAndClosesAssignment() {

        // 1. Dispatch toàn bộ đơn hàng.
        DeliveryDispatchResponse dispatchResponse =
                deliveryDispatchService.dispatch(
                        firstAssignmentId,
                        salesStaffId,
                        SALES_STAFF);

        assertThat(dispatchResponse.orderStatus())
                .isEqualTo(OrderStatus.OUT_FOR_DELIVERY);

        assertThat(dispatchResponse.lines())
                .hasSize(1);

        assertThat(dispatchResponse.lines().get(0).quantityLoaded())
                .isEqualTo(ORDER_QUANTITY);

        // 2. Ghi nhận giao hàng thành công.
        DeliveryAttemptResponse attempt =
                deliveryAttemptWorkflowService.recordAttempt(
                        firstAssignmentId,
                        driverId,
                        DELIVERY_STAFF,
                        new DeliveryAttemptCreateRequest(
                                DeliveryAttemptOutcome.SUCCESS,
                                "BE3 Test Customer",
                                null,
                                "Successful delivery integration test"));

        assertThat(attempt.outcome())
                .isEqualTo(DeliveryAttemptOutcome.SUCCESS);

        assertThat(attempt.attemptNo())
                .isEqualTo(1);

        // 3. Đơn hàng phải chuyển sang DELIVERED.
        assertThat(orderStatus())
                .isEqualTo("DELIVERED");

        // 4. Assignment phải được deactivate.
        assertThat(assignmentActive(firstAssignmentId))
                .isFalse();

        // 5. Toàn bộ hàng đã xuất được ghi nhận là đã giao.
        assertThat(jdbc.queryForObject(
                """
                SELECT quantity_delivered
                FROM delivery_load_items
                WHERE assignment_id = ?
                """,
                Integer.class,
                firstAssignmentId))
                .isEqualTo(ORDER_QUANTITY);

        // 6. Lịch sử của đơn hàng phải có một Attempt.
        List<DeliveryAttemptResponse> history =
                deliveryAttemptWorkflowService.findOrderAttempts(
                        orderId,
                        driverId,
                        DELIVERY_STAFF);

        assertThat(history)
                .hasSize(1);

        assertThat(history.get(0).attemptNo())
                .isEqualTo(1);

        assertThat(history.get(0).outcome())
                .isEqualTo(DeliveryAttemptOutcome.SUCCESS);
    }

    @Test
    void failedDeliveryReturnInspectionAndRedeliveryCompleteSuccessfully() {

        // --------------------------------------------------
        // PHẦN 1: DISPATCH LẦN GIAO ĐẦU
        // --------------------------------------------------

        deliveryDispatchService.dispatch(
                firstAssignmentId,
                salesStaffId,
                SALES_STAFF);

        assertThat(orderStatus())
                .isEqualTo("OUT_FOR_DELIVERY");

        assertThat(inventoryOnHand())
                .isEqualTo(INITIAL_STOCK - ORDER_QUANTITY);

        // --------------------------------------------------
        // PHẦN 2: GHI NHẬN GIAO HÀNG THẤT BẠI
        // --------------------------------------------------

        DeliveryAttemptResponse failedAttempt =
                deliveryAttemptWorkflowService.recordAttempt(
                        firstAssignmentId,
                        driverId,
                        DELIVERY_STAFF,
                        new DeliveryAttemptCreateRequest(
                                DeliveryAttemptOutcome.FAILED,
                                "BE3 Test Customer",
                                "Recipient unavailable",
                                "Failed first delivery"));

        assertThat(failedAttempt.outcome())
                .isEqualTo(DeliveryAttemptOutcome.FAILED);

        assertThat(failedAttempt.attemptNo())
                .isEqualTo(1);

        // Giao thất bại không được tự động nhập lại tồn kho.
        assertThat(inventoryOnHand())
                .isEqualTo(INITIAL_STOCK - ORDER_QUANTITY);

        assertThat(reservationReturned())
                .isZero();

        assertThat(reservationDamaged())
                .isZero();

        assertThat(orderStatus())
                .isEqualTo("OUT_FOR_DELIVERY");

        // --------------------------------------------------
        // PHẦN 3: KIỂM TRA HÀNG HOÀN
        // --------------------------------------------------

        Long loadItemId = jdbc.queryForObject(
                """
                SELECT id
                FROM delivery_load_items
                WHERE assignment_id = ?
                """,
                Long.class,
                firstAssignmentId);

        ReturnInspectionCreateRequest inspectionRequest =
                new ReturnInspectionCreateRequest(
                        List.of(
                                new ReturnInspectionCreateRequest.Line(
                                        loadItemId,
                                        2,
                                        1,
                                        "Two resellable, one damaged")),
                        "Inspect all returned goods");

        ReturnInspectionResponse inspection =
                returnInspectionWorkflowService.inspectReturn(
                        failedAttempt.id(),
                        salesStaffId,
                        SALES_STAFF,
                        inspectionRequest);

        assertThat(inspection.attemptId())
                .isEqualTo(failedAttempt.id());

        assertThat(inspection.lines())
                .hasSize(1);

        // Chỉ hai sản phẩm đủ điều kiện được nhập lại tồn.
        assertThat(inventoryOnHand())
                .isEqualTo(INITIAL_STOCK - ORDER_QUANTITY + 2);

        assertThat(reservationReturned())
                .isEqualTo(2);

        assertThat(reservationDamaged())
                .isEqualTo(1);

        // Assignment cũ phải được deactivate sau khi xử lý hàng hoàn.
        assertThat(assignmentActive(firstAssignmentId))
                .isFalse();

        // Order vẫn OUT_FOR_DELIVERY để chờ quy trình giao lại.
        assertThat(orderStatus())
                .isEqualTo("OUT_FOR_DELIVERY");

        // --------------------------------------------------
        // PHẦN 4: TẠO CHUYẾN MỚI VÀ REDELIVERY
        // --------------------------------------------------

        Long newTripId = createTrip();

        DeliveryRedeliveryResponse redelivery =
                redeliveryWorkflowService.prepareRedelivery(
                        failedAttempt.id(),
                        newTripId,
                        salesStaffId,
                        SALES_STAFF);

        assertThat(redelivery.orderId())
                .isEqualTo(orderId);

        assertThat(redelivery.orderStatus())
                .isEqualTo(OrderStatus.PREPARING);

        assertThat(redelivery.newTripId())
                .isEqualTo(newTripId);

        assertThat(redelivery.newAssignmentId())
                .isNotNull()
                .isNotEqualTo(firstAssignmentId);

        Long newAssignmentId = redelivery.newAssignmentId();

        assertThat(orderStatus())
                .isEqualTo("PREPARING");

        assertThat(assignmentActive(firstAssignmentId))
                .isFalse();

        assertThat(assignmentActive(newAssignmentId))
                .isTrue();

        // Reservation mới phải được tạo, reservation cũ được giữ lịch sử.
        assertThat(jdbc.queryForObject(
                """
                SELECT COUNT(*)
                FROM stock_reservations
                WHERE order_item_id = ?
                """,
                Integer.class,
                orderItemId))
                .isEqualTo(2);

        // --------------------------------------------------
        // PHẦN 5: DISPATCH LẦN GIAO THỨ HAI
        // --------------------------------------------------

        DeliveryDispatchResponse secondDispatch =
                deliveryDispatchService.dispatch(
                        newAssignmentId,
                        salesStaffId,
                        SALES_STAFF);

        assertThat(secondDispatch.orderStatus())
                .isEqualTo(OrderStatus.OUT_FOR_DELIVERY);

        assertThat(secondDispatch.lines())
                .hasSize(1);

        assertThat(secondDispatch.lines().get(0).quantityLoaded())
                .isEqualTo(ORDER_QUANTITY);

        // --------------------------------------------------
        // PHẦN 6: GIAO THÀNH CÔNG LẦN THỨ HAI
        // --------------------------------------------------

        DeliveryAttemptResponse successfulAttempt =
                deliveryAttemptWorkflowService.recordAttempt(
                        newAssignmentId,
                        driverId,
                        DELIVERY_STAFF,
                        new DeliveryAttemptCreateRequest(
                                DeliveryAttemptOutcome.SUCCESS,
                                "BE3 Test Customer",
                                null,
                                "Successful redelivery"));

        assertThat(successfulAttempt.outcome())
                .isEqualTo(DeliveryAttemptOutcome.SUCCESS);

        assertThat(successfulAttempt.attemptNo())
                .isEqualTo(2);

        assertThat(orderStatus())
                .isEqualTo("DELIVERED");

        assertThat(assignmentActive(newAssignmentId))
                .isFalse();

        // --------------------------------------------------
        // PHẦN 7: KIỂM TRA LỊCH SỬ CŨ VÀ MỚI
        // --------------------------------------------------

        List<DeliveryAttemptResponse> history =
                deliveryAttemptWorkflowService.findOrderAttempts(
                        orderId,
                        driverId,
                        DELIVERY_STAFF);

        assertThat(history)
                .hasSize(2);

        assertThat(history)
                .extracting(DeliveryAttemptResponse::attemptNo)
                .containsExactly(1, 2);

        assertThat(history)
                .extracting(DeliveryAttemptResponse::outcome)
                .containsExactly(
                        DeliveryAttemptOutcome.FAILED,
                        DeliveryAttemptOutcome.SUCCESS);

        assertThat(history)
                .extracting(DeliveryAttemptResponse::assignmentId)
                .containsExactly(
                        firstAssignmentId,
                        newAssignmentId);

        // Hai lần dispatch và một lần nhập lại hàng bán được.
        assertThat(movementCount("DISPATCH"))
                .isEqualTo(2);

        assertThat(movementCount("RETURN"))
                .isEqualTo(1);
    }

    private Long ensureRole(String roleCode) {

        jdbc.update(
                """
                INSERT INTO roles (code, name)
                VALUES (?, ?)
                ON CONFLICT (code) DO NOTHING
                """,
                roleCode,
                roleCode);

        return jdbc.queryForObject(
                "SELECT id FROM roles WHERE code = ?",
                Long.class,
                roleCode);
    }

    private Long createUser(
            Long roleId,
            String fullName,
            String email) {

        return jdbc.queryForObject(
                """
                INSERT INTO users (
                    role_id,
                    full_name,
                    email,
                    password_hash,
                    status
                )
                VALUES (?, ?, ?, ?, 'ACTIVE')
                RETURNING id
                """,
                Long.class,
                roleId,
                fullName,
                email,
                "integration-test-password-hash");
    }

    private Long createTrip() {

        Long tripId = jdbc.queryForObject(
                """
                INSERT INTO delivery_trips (
                    driver_id,
                    status,
                    created_by
                )
                VALUES (?, 'CREATED', ?)
                RETURNING id
                """,
                Long.class,
                driverId,
                salesStaffId);

        createdTripIds.add(tripId);

        return tripId;
    }

    private String orderStatus() {

        return jdbc.queryForObject(
                "SELECT status FROM orders WHERE id = ?",
                String.class,
                orderId);
    }

    private boolean assignmentActive(Long assignmentId) {

        return Boolean.TRUE.equals(
                jdbc.queryForObject(
                        """
                        SELECT active
                        FROM delivery_assignments
                        WHERE id = ?
                        """,
                        Boolean.class,
                        assignmentId));
    }

    private int inventoryOnHand() {

        return jdbc.queryForObject(
                """
                SELECT on_hand
                FROM inventory_balances
                WHERE batch_id = ?
                """,
                Integer.class,
                batchId);
    }

    private int reservationReturned() {

        return jdbc.queryForObject(
                """
                SELECT quantity_returned
                FROM stock_reservations
                WHERE order_item_id = ?
                ORDER BY id
                LIMIT 1
                """,
                Integer.class,
                orderItemId);
    }

    private int reservationDamaged() {

        return jdbc.queryForObject(
                """
                SELECT quantity_damaged
                FROM stock_reservations
                WHERE order_item_id = ?
                ORDER BY id
                LIMIT 1
                """,
                Integer.class,
                orderItemId);
    }

    private int movementCount(String movementType) {

        return jdbc.queryForObject(
                """
                SELECT COUNT(*)
                FROM inventory_movements
                WHERE movement_type = ?
                  AND reference_type = 'ORDER'
                  AND reference_id = ?
                """,
                Integer.class,
                movementType,
                orderId);
    }
}
