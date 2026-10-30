package com.aquaflow.inventory.application;

import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Chạy trên PostgreSQL thật (CI cung cấp DB_URL) để kiểm tra xuất kho, hàng hoàn và giao lại
 * với khóa dòng và ràng buộc DB. Dữ liệu được dọn ở @AfterEach.
 */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class InventoryDispatchPostgresIntegrationTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private InventoryDispatchService dispatchService;
    @Autowired private StockReservationService reservationService;
    @Autowired private StockService stockService;
    @Autowired private TransactionTemplate transactionTemplate;

    private Long productId;
    private Long orderId;
    private Long userId;
    private Long roleId;

    @BeforeEach
    void setUp() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        roleId = jdbc.queryForObject(
                "INSERT INTO roles (code, name) VALUES (?, 'Dispatch test') RETURNING id", Long.class, "DSP_" + suffix);
        userId = jdbc.queryForObject(
                "INSERT INTO users (role_id, full_name, email, password_hash) VALUES (?, 'Dispatch test', ?, 'x') RETURNING id",
                Long.class, roleId, "dsp-" + suffix + "@test.local");
        productId = jdbc.queryForObject(
                "INSERT INTO products (sku, name, unit, sale_price) VALUES (?, 'Dispatch test', 'binh', 20000) RETURNING id",
                Long.class, "DSP-" + suffix);
        orderId = jdbc.queryForObject(
                "INSERT INTO orders (order_code, channel, fulfillment_type) VALUES (?, 'COUNTER', 'COUNTER') RETURNING id",
                Long.class, "DSP-" + suffix);
    }

    @AfterEach
    void tearDown() {
        jdbc.update("DELETE FROM inventory_movements WHERE batch_id IN (SELECT id FROM product_batches WHERE product_id = ?)", productId);
        jdbc.update("DELETE FROM stock_reservations WHERE batch_id IN (SELECT id FROM product_batches WHERE product_id = ?)", productId);
        jdbc.update("DELETE FROM order_items WHERE order_id = ?", orderId);
        jdbc.update("DELETE FROM orders WHERE id = ?", orderId);
        jdbc.update("DELETE FROM inventory_balances WHERE batch_id IN (SELECT id FROM product_batches WHERE product_id = ?)", productId);
        jdbc.update("DELETE FROM product_batches WHERE product_id = ?", productId);
        jdbc.update("DELETE FROM products WHERE id = ?", productId);
        jdbc.update("DELETE FROM users WHERE id = ?", userId);
        jdbc.update("DELETE FROM roles WHERE id = ?", roleId);
    }

    @Test
    void dispatchReturnAndRedeliveryKeepStockAndHistoryConsistent() {
        Long batchId = addBatch("LOT-A", LocalDate.now().plusDays(30), 10);
        Long item = addOrderItem(4);
        reservationService.reserve(List.of(new ReservationLine(item, productId, 4)));

        dispatchService.dispatch(orderId, List.of(item), userId);
        var afterDispatch = stockService.findByProduct(productId);
        assertThat(afterDispatch.onHand()).isEqualTo(6);
        assertThat(afterDispatch.reserved()).isZero();
        assertThat(movementCount("DISPATCH")).isEqualTo(1);

        dispatchService.receiveReturn(orderId, List.of(new ReturnLine(item, batchId, 3, 1)), "Khách vắng nhà", userId);
        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(9);
        assertThat(movementCount("RETURN")).isEqualTo(1);

        reservationService.reserveForRedelivery(List.of(new ReservationLine(item, productId, 4)));
        dispatchService.dispatch(orderId, List.of(item), userId);

        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(5);
        assertThat(jdbc.queryForList(
                "SELECT quantity_dispatched || '/' || quantity_returned || '/' || quantity_damaged FROM stock_reservations WHERE order_item_id = ? ORDER BY id",
                String.class, item)).containsExactly("4/3/1", "4/0/0");
        assertThat(movementCount("DISPATCH")).isEqualTo(2);
    }

    @Test
    void twoConcurrentDispatchesOfTheSameOrderOnlyDeductOnce() throws Exception {
        addBatch("LOT-A", LocalDate.now().plusDays(30), 10);
        Long item = addOrderItem(5);
        reservationService.reserve(List.of(new ReservationLine(item, productId, 5)));

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<Future<Boolean>> results = new ArrayList<>();
        for (int i = 0; i < 2; i++) {
            Callable<Boolean> task = () -> {
                start.await();
                try {
                    dispatchService.dispatch(orderId, List.of(item), userId);
                    return true;
                } catch (ConflictException e) {
                    return false;
                }
            };
            results.add(pool.submit(task));
        }
        start.countDown();
        int succeeded = 0;
        for (Future<Boolean> result : results) {
            succeeded += result.get() ? 1 : 0;
        }
        pool.shutdown();

        assertThat(succeeded).isEqualTo(1);
        assertThat(stockService.findByProduct(productId).onHand()).isEqualTo(5);
        assertThat(movementCount("DISPATCH")).isEqualTo(1);
    }

    @Test
    void failureAfterDispatchRollsBackEverything() {
        addBatch("LOT-A", LocalDate.now().plusDays(30), 10);
        Long item = addOrderItem(3);
        reservationService.reserve(List.of(new ReservationLine(item, productId, 3)));

        // Mô phỏng module delivery đổi trạng thái đơn thất bại sau khi đã xuất kho trong cùng transaction
        assertThatThrownBy(() -> transactionTemplate.executeWithoutResult(status -> {
            dispatchService.dispatch(orderId, List.of(item), userId);
            throw new IllegalStateException("Cập nhật trạng thái đơn thất bại");
        })).isInstanceOf(IllegalStateException.class);

        var stock = stockService.findByProduct(productId);
        assertThat(stock.onHand()).isEqualTo(10);
        assertThat(stock.reserved()).isEqualTo(3);
        assertThat(movementCount("DISPATCH")).isZero();
        assertThat(jdbc.queryForObject(
                "SELECT quantity_dispatched FROM stock_reservations WHERE order_item_id = ?", Integer.class, item)).isZero();
    }

    private int movementCount(String type) {
        return jdbc.queryForObject("""
                SELECT count(*) FROM inventory_movements m JOIN product_batches b ON b.id = m.batch_id
                WHERE b.product_id = ? AND m.movement_type = ?
                """, Integer.class, productId, type);
    }

    private Long addBatch(String lot, LocalDate expiresOn, int onHand) {
        Long batchId = jdbc.queryForObject(
                "INSERT INTO product_batches (product_id, lot_code, expires_on) VALUES (?, ?, ?) RETURNING id",
                Long.class, productId, lot, expiresOn);
        jdbc.update("INSERT INTO inventory_balances (batch_id, on_hand) VALUES (?, ?)", batchId, onHand);
        return batchId;
    }

    private Long addOrderItem(int quantity) {
        return jdbc.queryForObject("""
                INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
                VALUES (?, ?, ?, 20000, ?) RETURNING id
                """, Long.class, orderId, productId, quantity, quantity * 20000);
    }
}
