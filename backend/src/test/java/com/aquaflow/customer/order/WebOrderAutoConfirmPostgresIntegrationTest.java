package com.aquaflow.customer.order;

import com.aquaflow.customer.order.api.dto.GuestOrderCreateRequest;
import com.aquaflow.customer.order.api.dto.OrderItemRequest;
import com.aquaflow.customer.order.api.dto.OrderUpdateRequest;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Đơn web tự xác nhận và giữ hàng khi đủ hàng; thiếu hàng thì chờ nhân viên xác nhận. */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
@Transactional
class WebOrderAutoConfirmPostgresIntegrationTest {
    @Autowired OrderService orders;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager entities;
    long productId, batchId;

    @BeforeEach void stock() {
        String tag = UUID.randomUUID().toString();
        productId = jdbc.queryForObject("INSERT INTO products(sku, name, unit, sale_price) VALUES (?, 'Nước 19L', 'Bình', 50000) RETURNING id",
                Long.class, "AUTO-" + tag);
        batchId = jdbc.queryForObject("INSERT INTO product_batches(product_id, lot_code, expires_on) VALUES (?, ?, ?) RETURNING id",
                Long.class, productId, tag, LocalDate.now().plusDays(90));
        jdbc.update("INSERT INTO inventory_balances(batch_id, on_hand, reserved) VALUES (?, 5, 0)", batchId);
    }

    long place(int quantity) {
        return orders.createForGuest(new GuestOrderCreateRequest("Khách", "0901234567", "12 Lê Lợi", "Phường Bến Thành",
                null, List.of(new OrderItemRequest(productId, quantity)), null)).id();
    }

    OrderStatus status(long id) {
        entities.flush();
        return OrderStatus.valueOf(jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String.class, id));
    }

    int reserved() {
        entities.flush(); // đọc bằng JDBC: ghi các thay đổi của Hibernate xuống trước
        return jdbc.queryForObject("SELECT reserved FROM inventory_balances WHERE batch_id = ?", Integer.class, batchId);
    }

    @Test void enoughStockConfirmsAndReservesRightAway() {
        long id = place(3);
        assertThat(status(id)).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(reserved()).isEqualTo(3);
    }

    @Test void shortStockWaitsForTheStoreWithoutReservingAnything() {
        long first = place(4);
        long second = place(2); // chỉ còn 1
        assertThat(status(first)).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(status(second)).isEqualTo(OrderStatus.PENDING);
        assertThat(reserved()).isEqualTo(4);
    }

    @Test void editingAConfirmedOrderMovesTheReservationAndRollsBackWhenShort() {
        long id = place(2);
        var edit = (java.util.function.IntFunction<OrderUpdateRequest>) quantity -> new OrderUpdateRequest("Khách", "0901234567",
                "12 Lê Lợi", "Phường Bến Thành", null, List.of(new OrderItemRequest(productId, quantity)), "đổi số lượng");
        orders.updatePending(id, edit.apply(4));
        assertThat(status(id)).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(reserved()).isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT SUM(quantity) FROM order_items WHERE order_id = ?", Integer.class, id)).isEqualTo(4);

        assertThatThrownBy(() -> orders.updatePending(id, edit.apply(9))).isInstanceOf(ConflictException.class);
    }

    @Test void customerCancellingAConfirmedOrderReleasesTheStock() {
        long customer = jdbc.queryForObject("INSERT INTO customers(full_name) VALUES ('Khách') RETURNING id", Long.class);
        long id = place(3);
        entities.flush();
        jdbc.update("UPDATE orders SET customer_id = ? WHERE id = ?", customer, id);
        entities.clear();
        assertThat(orders.cancelForCustomer(id, customer).status()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(reserved()).isZero();
    }
}
