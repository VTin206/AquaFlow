package com.aquaflow.inventory.application;

import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.delivery.application.DeliveryService;
import com.aquaflow.delivery.api.DeliveryDtos.*;
import com.aquaflow.inventory.api.ReturnDtos.Create;
import com.aquaflow.inventory.api.ReturnDtos.LineInput;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Chạy trên PostgreSQL thật (CI cung cấp DB_URL): kiểm nhận hàng hoàn sau lần giao thất bại
 * và giữ hàng mới cho lần giao lại. Dữ liệu chuyến giao được tạo trực tiếp bằng SQL.
 */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class InventoryReturnPostgresIntegrationTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private OrderService orders;
    @Autowired private DeliveryService delivery;
    @Autowired private InventoryReturnService returns;
    @Autowired private RedeliveryReservationService redelivery;
    @Autowired private StockService stockService;
    @Autowired private org.springframework.transaction.PlatformTransactionManager transactions;
    @Autowired private com.aquaflow.delivery.application.DeliveryAssignmentService assignments;

    private Long productId;
    private Long orderId;
    private Long itemId;
    private Long actorId;
    private Long driverId;
    private Long tripId;

    @BeforeEach
    void setUp() {
        String suffix = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO roles (code, name) VALUES ('SALES_STAFF', 'Sales') ON CONFLICT (code) DO NOTHING");
        jdbc.update("INSERT INTO roles (code, name) VALUES ('DELIVERY_STAFF', 'Driver') ON CONFLICT (code) DO NOTHING");
        actorId = jdbc.queryForObject("""
                INSERT INTO users (role_id, full_name, email, password_hash)
                VALUES ((SELECT id FROM roles WHERE code = 'SALES_STAFF'), 'Return test', ?, 'unused') RETURNING id
                """, Long.class, suffix + "@return.test");
        driverId = jdbc.queryForObject("""
                INSERT INTO users (role_id, full_name, email, password_hash)
                VALUES ((SELECT id FROM roles WHERE code = 'DELIVERY_STAFF'), 'Return driver', ?, 'unused') RETURNING id
                """, Long.class, suffix + "@driver.return.test");
        productId = jdbc.queryForObject(
                "INSERT INTO products (sku, name, unit, sale_price) VALUES (?, 'Return test', 'binh', 20) RETURNING id",
                Long.class, suffix);
        orderId = jdbc.queryForObject(
                "INSERT INTO orders (order_code, channel, fulfillment_type) VALUES (?, 'PHONE', 'DELIVERY') RETURNING id",
                Long.class, suffix);
        itemId = jdbc.queryForObject("""
                INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
                VALUES (?, ?, 5, 20, 100) RETURNING id
                """, Long.class, orderId, productId);
    }

    @AfterEach
    void tearDown() {
        jdbc.update("DELETE FROM inventory_return_lines WHERE return_id IN (SELECT id FROM inventory_returns WHERE order_id = ?)", orderId);
        jdbc.update("DELETE FROM inventory_returns WHERE order_id = ?", orderId);
        jdbc.update("DELETE FROM delivery_load_items WHERE order_item_id = ?", itemId);
        jdbc.update("DELETE FROM delivery_attempts WHERE assignment_id IN (SELECT id FROM delivery_assignments WHERE order_id = ?)", orderId);
        jdbc.update("DELETE FROM delivery_assignments WHERE order_id = ?", orderId);
        if (tripId != null) {
            jdbc.update("DELETE FROM handover_records WHERE trip_id = ?", tripId);
            jdbc.update("DELETE FROM delivery_trips WHERE id = ?", tripId);
        }
        jdbc.update("DELETE FROM audit_logs WHERE actor_id = ? OR (entity_type = 'ORDER' AND entity_id = ?)"
                + " OR (entity_type = 'DISPATCH' AND entity_id IN (SELECT id FROM order_dispatches WHERE order_id = ?))",
                actorId, orderId, orderId);
        jdbc.update("DELETE FROM order_dispatch_items WHERE dispatch_id IN (SELECT id FROM order_dispatches WHERE order_id = ?)", orderId);
        jdbc.update("DELETE FROM order_dispatches WHERE order_id = ?", orderId);
        jdbc.update("DELETE FROM order_status_history WHERE order_id = ?", orderId);
        jdbc.update("DELETE FROM inventory_movements WHERE reference_type = 'ORDER' AND reference_id = ?", orderId);
        jdbc.update("DELETE FROM stock_reservations WHERE order_item_id = ?", itemId);
        jdbc.update("DELETE FROM order_items WHERE order_id = ?", orderId);
        jdbc.update("DELETE FROM orders WHERE id = ?", orderId);
        jdbc.update("DELETE FROM inventory_balances WHERE batch_id IN (SELECT id FROM product_batches WHERE product_id = ?)", productId);
        jdbc.update("DELETE FROM product_batches WHERE product_id = ?", productId);
        jdbc.update("DELETE FROM products WHERE id = ?", productId);
        jdbc.update("DELETE FROM users WHERE id = ?", actorId);
        jdbc.update("DELETE FROM users WHERE id = ?", driverId);
    }

    @Test
    void inspectionRestocksOnlySellableGoodsAndKeepsDispatchHistory() {
        batch("LOT-A", 30, 10);
        Long loadItemId = dispatchAndFailDelivery();
        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(5);

        returns.create(new Create(orderId, List.of(new LineInput(loadItemId, 3)), "2 bình móp"), actorId);

        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(8);
        assertThat(jdbc.queryForObject("""
                SELECT quantity FROM inventory_movements
                WHERE reference_type = 'ORDER' AND reference_id = ? AND movement_type = 'RETURN'
                """, Integer.class, orderId)).isEqualTo(3);
        assertThat(jdbc.queryForObject(
                "SELECT quantity_returned FROM delivery_load_items WHERE id = ?", Integer.class, loadItemId)).isEqualTo(5);
        assertThat(jdbc.queryForObject(
                "SELECT sum(quantity_dispatched) FROM stock_reservations WHERE order_item_id = ?", Integer.class, itemId))
                .isEqualTo(5);
    }

    @Test
    void damagedGoodsRequireNoteAndRejectedInspectionChangesNothing() {
        batch("LOT-A", 30, 10);
        Long loadItemId = dispatchAndFailDelivery();

        assertThatThrownBy(() -> returns.create(new Create(orderId, List.of(new LineInput(loadItemId, 4)), " "), actorId))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> returns.create(new Create(orderId, List.of(new LineInput(loadItemId, 6)), null), actorId))
                .isInstanceOf(BadRequestException.class);

        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(5);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_returns WHERE order_id = ?", Integer.class, orderId)).isZero();
    }

    @Test
    void sameReturnCannotBeInspectedTwice() {
        batch("LOT-A", 30, 10);
        Long loadItemId = dispatchAndFailDelivery();
        returns.create(new Create(orderId, List.of(new LineInput(loadItemId, 5)), null), actorId);

        assertThatThrownBy(() -> returns.create(new Create(orderId, List.of(new LineInput(loadItemId, 5)), null), actorId))
                .isInstanceOf(ConflictException.class);
        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(10);
    }

    @Test
    void partialReceiptsKeepRemainingOutsideAndHistoryImmutable() {
        batch("PARTIAL", 30, 10);
        Long load = dispatchAndFailDelivery();
        var first = new Create(orderId, List.of(new LineInput(load, 1, 2)), "One damaged", UUID.randomUUID());
        long attempt = returns.pending().stream().filter(p -> p.orderId()==orderId).findFirst().orElseThrow().attemptId();
        var receipt = returns.create(first, actorId);
        assertThat(receipt.lines().getFirst().quantity()).isEqualTo(2);
        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(6);
        assertThat(returns.pending().stream().filter(p -> p.orderId()==orderId).findFirst().orElseThrow().lines().getFirst().quantity()).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id=?", String.class, orderId)).isEqualTo("OUT_FOR_DELIVERY");
        assertThatThrownBy(() -> redelivery.reserve(List.of(new ReservationLine(itemId, productId, 5))))
                .isInstanceOf(ConflictException.class);
        assertThat(returns.create(first, actorId).id()).isEqualTo(receipt.id());
        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(6);
        assertThatThrownBy(() -> returns.create(new Create(orderId, List.of(new LineInput(load, 2, 2)), null, first.requestId()), actorId))
                .isInstanceOf(ConflictException.class);
        var second = new Create(orderId, List.of(new LineInput(load, 3, 3)), null, UUID.randomUUID());
        var secondReceipt = returns.create(second, actorId);
        assertThat(returns.create(second, actorId).id()).isEqualTo(secondReceipt.id());
        assertThat(assignments.inspect(attempt, new com.aquaflow.inventory.api.ReturnDtos.AttemptInspection(second.lines(), second.note(), second.requestId()), actorId, true).id())
                .isEqualTo(secondReceipt.id());
        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(9);
        assertThat(returns.get(receipt.id()).lines().getFirst().quantity()).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT quantity_returned FROM delivery_load_items WHERE id=?", Integer.class, load)).isEqualTo(5);
        assertThat(jdbc.queryForObject("SELECT SUM(quantity_dispatched) FROM stock_reservations WHERE order_item_id=?", Integer.class, itemId)).isEqualTo(5);
        assertThat(jdbc.queryForObject("SELECT SUM(quantity) FROM inventory_movements WHERE reference_id=? AND movement_type='RETURN'", Integer.class, orderId)).isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id=?", String.class, orderId)).isEqualTo("CANCELLED");
        redelivery.reserve(List.of(new ReservationLine(itemId, productId, 5)));
        assertThat(stockService.findByProduct(productId).reserved()).isEqualTo(5);
    }

    @Test
    void rejectsExcessUnknownLotAndSellableAboveActualWithoutChangingStock() {
        batch("INVALID-ACTUAL", 30, 10);
        Long load = dispatchAndFailDelivery();
        for (var line : List.of(new LineInput(load, 6, 6), new LineInput(load, 3, 2),
                new LineInput(load, 0, 0), new LineInput(Long.MAX_VALUE, 1, 1))) {
            assertThatThrownBy(() -> returns.create(new Create(orderId, List.of(line), "Check", UUID.randomUUID()), actorId))
                    .isInstanceOf(BadRequestException.class);
        }
        assertThatThrownBy(() -> returns.create(new Create(orderId, List.of(new LineInput(load, 2, 2)), null), actorId))
                .isInstanceOf(BadRequestException.class);
        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(5);
        assertThat(jdbc.queryForObject("SELECT quantity_returned FROM delivery_load_items WHERE id=?", Integer.class, load)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_returns WHERE order_id=?", Integer.class, orderId)).isZero();
    }

    @Test
    void concurrentRetriesCreateOneReceiptAndOneStockIncrease() throws Exception {
        batch("RETRY", 30, 10);
        Long load = dispatchAndFailDelivery();
        var input = new Create(orderId, List.of(new LineInput(load, 2, 2)), null, UUID.randomUUID());
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Long> save = () -> { start.await(); return returns.create(input, actorId).id(); };
            var a = pool.submit(save); var b = pool.submit(save); start.countDown();
            assertThat(a.get(15, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(b.get(15, java.util.concurrent.TimeUnit.SECONDS));
        }
        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(7);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_returns WHERE order_id=?", Integer.class, orderId)).isEqualTo(1);
    }

    @Test
    void concurrentDifferentReceiptsCannotExceedRemainingGoods() throws Exception {
        batch("CONCURRENT", 30, 10);
        Long load = dispatchAndFailDelivery();
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Boolean> save = () -> {
                start.await();
                try {
                    returns.create(new Create(orderId, List.of(new LineInput(load, 3, 3)), null, UUID.randomUUID()), actorId);
                    return true;
                } catch (BadRequestException expected) { return false; }
            };
            var a=pool.submit(save); var b=pool.submit(save); start.countDown();
            assertThat(List.of(a.get(15, java.util.concurrent.TimeUnit.SECONDS), b.get(15, java.util.concurrent.TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(true, false);
        }
        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(8);
        assertThat(jdbc.queryForObject("SELECT quantity_returned FROM delivery_load_items WHERE id=?", Integer.class, load)).isEqualTo(3);
    }

    @Test
    void receiptAndStockRollbackWhenTheCallingWorkflowFails() {
        batch("ROLLBACK", 30, 10);
        Long load = dispatchAndFailDelivery();
        var input=new Create(orderId, List.of(new LineInput(load, 2, 2)), null, UUID.randomUUID());
        assertThatThrownBy(() -> new org.springframework.transaction.support.TransactionTemplate(transactions).execute(status -> {
            returns.create(input, actorId);
            throw new IllegalStateException("Simulated failure after inventory update");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(5);
        assertThat(jdbc.queryForObject("SELECT quantity_returned FROM delivery_load_items WHERE id=?", Integer.class, load)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_returns WHERE order_id=?", Integer.class, orderId)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movements WHERE reference_id=? AND movement_type='RETURN'", Integer.class, orderId)).isZero();
        returns.create(input, actorId);
        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(7);
    }

    @Test
    void oneBatchCanBeReceivedBeforeTheOtherAndExpiredGoodsAreNeverSellable() {
        batch("FIRST", 20, 3);
        batch("SECOND", 30, 7);
        dispatchAndFailDelivery();
        var pending = returns.pending().stream().filter(p -> p.orderId()==orderId).findFirst().orElseThrow();
        var a = pending.lines().get(0); var b = pending.lines().get(1);
        returns.create(new Create(orderId, List.of(new LineInput(a.loadItemId(), 3, 3)), null, UUID.randomUUID()), actorId);
        assertThat(returns.pending().stream().filter(p -> p.orderId()==orderId).findFirst().orElseThrow().lines()).hasSize(1);
        jdbc.update("UPDATE product_batches SET expires_on=CURRENT_DATE WHERE id=?", b.batchId());
        assertThatThrownBy(() -> returns.create(new Create(orderId, List.of(new LineInput(b.loadItemId(), 2, 2)), null, UUID.randomUUID()), actorId))
                .isInstanceOf(BadRequestException.class);
        returns.create(new Create(orderId, List.of(new LineInput(b.loadItemId(), 0, 2)), "Expired", UUID.randomUUID()), actorId);
        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(8);
        assertThat(jdbc.queryForObject("SELECT SUM(quantity_returned) FROM delivery_load_items WHERE order_item_id=?", Integer.class, itemId)).isEqualTo(5);
    }

    @Test
    void redeliveryReservesAgainOnlyAfterReturnIsInspected() {
        batch("LOT-A", 30, 10);
        Long loadItemId = dispatchAndFailDelivery();
        List<ReservationLine> lines = List.of(new ReservationLine(itemId, productId, 5));

        assertThatThrownBy(() -> redelivery.reserve(lines))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("chưa hoàn tất kiểm nhận");

        returns.create(new Create(orderId, List.of(new LineInput(loadItemId, 5)), null), actorId);
        redelivery.reserve(lines);

        var stock = stockService.findByProduct(productId);
        assertThat(stock.onHand()).isEqualTo(10);
        assertThat(stock.reserved()).isEqualTo(5);
        // Cùng lô LOT-A: reservation cũ (đã xuất) và reservation mới cùng tồn tại
        assertThat(jdbc.queryForList(
                "SELECT quantity_reserved || '/' || quantity_dispatched FROM stock_reservations WHERE order_item_id = ? ORDER BY id",
                String.class, itemId)).containsExactly("5/5", "5/0");

        assertThatThrownBy(() -> redelivery.reserve(lines))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("đang có hàng được giữ");
    }

    @Test
    void redeliveryRejectsOrderThatWasNeverDispatched() {
        batch("LOT-A", 30, 10);
        orders.transitionStatus(orderId, OrderStatus.CONFIRMED);

        assertThatThrownBy(() -> redelivery.reserve(List.of(new ReservationLine(itemId, productId, 5))))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("chưa từng xuất kho");
        assertThat(stockService.findByProduct(productId).reserved()).isEqualTo(5);
    }

    /** Xác nhận, xuất kho, chở đi trong một chuyến đã kết thúc với lần giao thất bại; trả về id load item. */
    private Long dispatchAndFailDelivery() {
        orders.transitionStatus(orderId, OrderStatus.CONFIRMED);
        orders.transitionStatus(orderId, OrderStatus.PREPARING);
        tripId = delivery.create(new CreateTripRequest(driverId, null), actorId, true).id();
        delivery.addOrder(tripId, new AddOrderRequest(orderId), actorId, true);
        delivery.dispatch(tripId, actorId, true);
        delivery.start(tripId, driverId, false);
        delivery.recordResult(tripId, orderId,
                new DeliveryResultRequest(Outcome.FAILED, null, "Khách vắng nhà", null), driverId, false);
        delivery.settle(tripId,
                new SettleTripRequest(BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, null), actorId, true);
        Long assignmentId = jdbc.queryForObject(
                "SELECT id FROM delivery_assignments WHERE trip_id = ? AND order_id = ?", Long.class, tripId, orderId);
        return jdbc.queryForObject("""
                SELECT id FROM delivery_load_items WHERE assignment_id = ? AND order_item_id = ? ORDER BY id LIMIT 1
                """, Long.class, assignmentId, itemId);
    }

    private void batch(String lot, int days, int quantity) {
        Long id = jdbc.queryForObject(
                "INSERT INTO product_batches (product_id, lot_code, expires_on) VALUES (?, ?, ?) RETURNING id",
                Long.class, productId, lot, LocalDate.now().plusDays(days));
        jdbc.update("INSERT INTO inventory_balances (batch_id, on_hand) VALUES (?, ?)", id, quantity);
    }
}
