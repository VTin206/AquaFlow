package com.aquaflow.inventory.application;

import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.shared.api.ConflictException;
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
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Chạy trên PostgreSQL thật (CI cung cấp DB_URL) để kiểm tra khóa dòng khi giữ hàng song song.
 * Không dùng @Transactional vì các luồng cần thấy dữ liệu đã commit; dữ liệu được dọn ở @AfterEach.
 */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class StockReservationPostgresIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private StockReservationService reservationService;

    @Autowired
    private StockService stockService;

    @Autowired
    private OrderService orderService;

    private Long productId;
    private Long orderId;

    @BeforeEach
    void setUp() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        productId = jdbc.queryForObject(
                "INSERT INTO products (sku, name, unit, sale_price) VALUES (?, 'Reserve test', 'binh', 20000) RETURNING id",
                Long.class, "RSV-" + suffix);
        orderId = jdbc.queryForObject(
                "INSERT INTO orders (order_code, channel, fulfillment_type) VALUES (?, 'COUNTER', 'COUNTER') RETURNING id",
                Long.class, "RSV-" + suffix);
    }

    @AfterEach
    void tearDown() {
        jdbc.update("DELETE FROM stock_reservations WHERE batch_id IN (SELECT id FROM product_batches WHERE product_id = ?)", productId);
        jdbc.update("DELETE FROM order_items WHERE order_id = ?", orderId);
        jdbc.update("DELETE FROM orders WHERE id = ?", orderId);
        jdbc.update("DELETE FROM inventory_balances WHERE batch_id IN (SELECT id FROM product_batches WHERE product_id = ?)", productId);
        jdbc.update("DELETE FROM product_batches WHERE product_id = ?", productId);
        jdbc.update("DELETE FROM products WHERE id = ?", productId);
    }

    @Test
    void twoConcurrentOrdersCannotReserveTheSameStock() throws Exception {
        addBatch("LOT-A", LocalDate.now().plusDays(30), 10);
        Long itemA = addOrderItem(7);
        Long itemB = addOrderItem(7);

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<Future<Boolean>> results = new ArrayList<>();
        for (Long itemId : List.of(itemA, itemB)) {
            Callable<Boolean> task = () -> {
                start.await();
                try {
                    reservationService.reserve(List.of(new ReservationLine(itemId, productId, 7)));
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
        var stock = stockService.findByProduct(productId);
        assertThat(stock.reserved()).isEqualTo(7);
        assertThat(stock.available()).isEqualTo(3);
    }

    @Test
    void reserveUsesFefoSkipsExpiredLotAndReleaseRestoresStock() {
        addBatch("EXPIRED", LocalDate.now().minusDays(1), 50);
        addBatch("LATER", LocalDate.now().plusDays(90), 10);
        addBatch("SOON", LocalDate.now().plusDays(10), 4);
        Long item = addOrderItem(6);

        reservationService.reserve(List.of(new ReservationLine(item, productId, 6)));

        List<String> reservedLots = jdbc.queryForList("""
                SELECT b.lot_code || ':' || r.quantity_reserved FROM stock_reservations r
                JOIN product_batches b ON b.id = r.batch_id WHERE r.order_item_id = ? ORDER BY b.expires_on
                """, String.class, item);
        assertThat(reservedLots).containsExactly("SOON:4", "LATER:2");
        var stock = stockService.findByProduct(productId);
        assertThat(stock.onHand()).isEqualTo(64);
        assertThat(stock.expiredOnHand()).isEqualTo(50);
        assertThat(stock.available()).isEqualTo(8);

        reservationService.release(List.of(item));

        assertThat(stockService.findByProduct(productId).available()).isEqualTo(14);
        assertThat(stockService.findByProduct(productId).reserved()).isZero();
    }

    @Test
    void confirmingOrderReservesStockAndCancellingReleasesIt() {
        addBatch("LOT-A", LocalDate.now().plusDays(30), 5);
        addOrderItem(3);

        orderService.transitionStatus(orderId, OrderStatus.CONFIRMED);
        assertThat(stockService.findByProduct(productId).available()).isEqualTo(2);

        orderService.transitionStatus(orderId, OrderStatus.CANCELLED);
        assertThat(stockService.findByProduct(productId).available()).isEqualTo(5);
        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, orderId))
                .isEqualTo("CANCELLED");
    }

    @Test
    void orderIsNotConfirmedWhenStockIsInsufficient() {
        addBatch("LOT-A", LocalDate.now().plusDays(30), 2);
        addOrderItem(3);

        assertThatThrownBy(() -> orderService.transitionStatus(orderId, OrderStatus.CONFIRMED))
                .isInstanceOf(ConflictException.class);

        assertThat(jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, orderId))
                .isEqualTo("PENDING");
        assertThat(stockService.findByProduct(productId).reserved()).isZero();
    }

    private void addBatch(String lot, LocalDate expiresOn, int onHand) {
        Long batchId = jdbc.queryForObject(
                "INSERT INTO product_batches (product_id, lot_code, expires_on) VALUES (?, ?, ?) RETURNING id",
                Long.class, productId, lot, expiresOn);
        jdbc.update("INSERT INTO inventory_balances (batch_id, on_hand) VALUES (?, ?)", batchId, onHand);
    }

    private Long addOrderItem(int quantity) {
        return jdbc.queryForObject("""
                INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
                VALUES (?, ?, ?, 20000, ?) RETURNING id
                """, Long.class, orderId, productId, quantity, quantity * 20000);
    }
}
