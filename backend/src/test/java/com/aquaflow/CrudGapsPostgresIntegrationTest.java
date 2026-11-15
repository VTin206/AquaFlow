package com.aquaflow;

import com.aquaflow.bottle.BottleLedgerDtos;
import com.aquaflow.bottle.BottleLedgerService;
import com.aquaflow.customer.order.api.dto.OrderCreateRequest;
import com.aquaflow.customer.order.api.dto.OrderItemRequest;
import com.aquaflow.customer.order.api.dto.OrderUpdateRequest;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderChannel;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.inventory.api.dto.StockAdjustmentDtos;
import com.aquaflow.inventory.application.StockAdjustmentService;
import com.aquaflow.payment.PaymentDtos;
import com.aquaflow.payment.PaymentService;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Mỗi thao tác tự commit (không bọc transaction) để đọc lại bằng SQL đúng như sau một request thật.
 * Các thao tác bổ sung: đổi tên loại vỏ, khách hủy đơn, kiểm kê lô, hủy phiếu thu, hủy giao dịch vỏ/cọc, sửa đơn chờ. */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class CrudGapsPostgresIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired OrderService orders;
    @Autowired StockAdjustmentService adjustments;
    @Autowired PaymentService payments;
    @Autowired BottleLedgerService bottles;

    long admin, product, customer;

    @BeforeEach
    void setup() {
        jdbc.update("INSERT INTO roles(code,name) VALUES ('ADMIN','Admin'),('SALES_STAFF','Sales') ON CONFLICT(code) DO NOTHING");
        admin = jdbc.queryForObject("INSERT INTO users(role_id,full_name,email,password_hash) VALUES ((SELECT id FROM roles WHERE code='ADMIN'),'Gap admin',?,'unused') RETURNING id",
                Long.class, UUID.randomUUID() + "@gaps.test");
        product = jdbc.queryForObject("INSERT INTO products(sku,name,unit,sale_price) VALUES (?,'Gap water','Bình',50000) RETURNING id",
                Long.class, "GAP-" + UUID.randomUUID());
        customer = jdbc.queryForObject("INSERT INTO customers(full_name) VALUES ('Gap customer') RETURNING id", Long.class);
    }

    private long pendingOrder(Long customerId, int quantity) {
        var request = new OrderCreateRequest(customerId, OrderChannel.PHONE, FulfillmentType.DELIVERY,
                "Khách", "0901234567", "12 Nguyễn Trãi", null, null,
                List.of(new OrderItemRequest(product, quantity)), "Gọi trước");
        return orders.createForStaff(request, admin).id();
    }

    private long batch(int onHand, int reserved) {
        long id = jdbc.queryForObject("INSERT INTO product_batches(product_id,lot_code,expires_on) VALUES (?,?,?) RETURNING id",
                Long.class, product, "LOT-" + UUID.randomUUID().toString().substring(0, 8), java.sql.Date.valueOf(LocalDate.now().plusYears(1)));
        jdbc.update("INSERT INTO inventory_balances(batch_id,on_hand,reserved) VALUES (?,?,?)", id, onHand, reserved);
        return id;
    }

    // 1. Đổi tên loại vỏ
    @Test
    void adminRenamesBottleTypeButNotToAnExistingName() throws Exception {
        long type = jdbc.queryForObject("INSERT INTO bottle_types(name,deposit_unit_amount) VALUES (?,50000) RETURNING id", Long.class, "Binh-" + UUID.randomUUID());
        String taken = "Taken-" + UUID.randomUUID();
        String renamed = "Bình mới " + UUID.randomUUID();
        jdbc.update("INSERT INTO bottle_types(name,deposit_unit_amount) VALUES (?,40000)", taken);
        mvc.perform(put("/api/v1/bottle-types/" + type).with(user("admin").roles("ADMIN")).contentType("application/json")
                .content("{\"name\":\"" + renamed + "\",\"depositUnitAmount\":55000}")).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT name FROM bottle_types WHERE id=?", String.class, type)).isEqualTo(renamed);
        mvc.perform(put("/api/v1/bottle-types/" + type).with(user("admin").roles("ADMIN")).contentType("application/json")
                .content("{\"name\":\"" + taken.toUpperCase() + "\",\"depositUnitAmount\":55000}")).andExpect(status().isConflict());
    }

    // 2. Khách tự hủy đơn
    @Test
    void customerCancelsOnlyOwnPendingOrder() {
        long order = pendingOrder(customer, 2);
        long other = jdbc.queryForObject("INSERT INTO customers(full_name) VALUES ('Other') RETURNING id", Long.class);
        assertThatThrownBy(() -> orders.cancelForCustomer(order, other)).isInstanceOf(NotFoundException.class);
        assertThat(orders.cancelForCustomer(order, customer).status()).isEqualTo(OrderStatus.CANCELLED);

        long confirmed = pendingOrder(customer, 1);
        jdbc.update("UPDATE orders SET status='CONFIRMED' WHERE id=?", confirmed);
        assertThatThrownBy(() -> orders.cancelForCustomer(confirmed, customer)).isInstanceOf(ConflictException.class);
    }

    // 3. Kiểm kê lô
    @Test
    void stocktakeSetsOnHandAndWritesMovementButKeepsReservedStock() throws Exception {
        long lot = batch(10, 3);
        var up = adjustments.adjust(new StockAdjustmentDtos.Create(lot, 12, "Đếm lại thấy dư"), admin);
        assertThat(up.delta()).isEqualTo(2);
        assertThat(up.code()).startsWith("DC-");
        assertThat(jdbc.queryForObject("SELECT on_hand FROM inventory_balances WHERE batch_id=?", Integer.class, lot)).isEqualTo(12);
        assertThat(jdbc.queryForObject("SELECT movement_type FROM inventory_movements WHERE reference_type='ADJUSTMENT' AND reference_id=?", String.class, up.id()))
                .isEqualTo("ADJUST_UP");

        var down = adjustments.adjust(new StockAdjustmentDtos.Create(lot, 5, "Vỡ 7 bình"), admin);
        assertThat(down.delta()).isEqualTo(-7);
        assertThat(jdbc.queryForObject("SELECT on_hand FROM inventory_balances WHERE batch_id=?", Integer.class, lot)).isEqualTo(5);
        // Không được thấp hơn 3 đang giữ cho đơn; số đếm trùng sổ thì không cần điều chỉnh.
        assertThatThrownBy(() -> adjustments.adjust(new StockAdjustmentDtos.Create(lot, 2, "Sai"), admin)).isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> adjustments.adjust(new StockAdjustmentDtos.Create(lot, 5, "Trùng"), admin)).isInstanceOf(BadRequestException.class);

        mvc.perform(post("/api/v1/inventory/adjustments").with(user("sales").roles("SALES_STAFF")).contentType("application/json")
                .content("{\"batchId\":" + lot + ",\"countedQuantity\":6,\"reason\":\"x\"}")).andExpect(status().isForbidden());
    }

    // 4. Hủy phiếu thu
    @Test
    void adminVoidsMistakenPaymentAndBalanceDropsIt() throws Exception {
        long order = pendingOrder(customer, 2);
        jdbc.update("UPDATE orders SET status='CONFIRMED' WHERE id=?", order);
        var receipt = payments.create(order, admin, new PaymentDtos.Create(UUID.randomUUID(), new BigDecimal("40000"), "IN", "CASH", null, null));
        assertThat(payments.payments(order).balance().paid()).isEqualByComparingTo("40000");

        mvc.perform(post("/api/v1/sales/orders/" + order + "/payments/" + receipt.id() + "/void").with(user("sales").roles("SALES_STAFF"))
                .contentType("application/json").content("{\"reason\":\"Ghi nhầm đơn\"}")).andExpect(status().isForbidden());

        var balance = payments.voidPayment(order, receipt.id(), admin, new PaymentDtos.Void("Ghi nhầm đơn"));
        assertThat(balance.paid()).isZero();
        assertThat(payments.payments(order).payments()).isEmpty();
        assertThat(jdbc.queryForObject("SELECT void_reason FROM payments WHERE id=?", String.class, receipt.id())).isEqualTo("Ghi nhầm đơn");
        assertThatThrownBy(() -> payments.voidPayment(order, receipt.id(), admin, new PaymentDtos.Void("Lần hai")))
                .isInstanceOf(ConflictException.class);
    }

    // 5. Hủy giao dịch vỏ/cọc
    @Test
    void adminVoidsBottleEntryOnceWithAReversingLine() {
        long type = jdbc.queryForObject("INSERT INTO bottle_types(name,deposit_unit_amount) VALUES (?,50000) RETURNING id", Long.class, "Void-" + UUID.randomUUID());
        var give = bottles.create(customer, admin, true, new BottleLedgerDtos.Create(UUID.randomUUID(), "GIVE", type, 2, null, "Giao nhầm"));
        var collect = bottles.create(customer, admin, true, new BottleLedgerDtos.Create(UUID.randomUUID(), "COLLECT", null, null, new BigDecimal("100000"), null));

        UUID request = UUID.randomUUID();
        var reversal = bottles.voidEntry(customer, UUID.fromString(give.id()), admin, new BottleLedgerDtos.Void(request, "Nhập nhầm khách"));
        assertThat(reversal.kind()).isEqualTo("VOID");
        assertThat(reversal.bottles()).isEqualTo(-2);
        // Gửi lại cùng mã yêu cầu: trả đúng dòng đã ghi, không đảo thêm lần nữa.
        assertThat(bottles.voidEntry(customer, UUID.fromString(give.id()), admin, new BottleLedgerDtos.Void(request, "Nhập nhầm khách")).id())
                .isEqualTo(reversal.id());
        var ledger = bottles.ledger(customer);
        assertThat(ledger.balance().bottlesHeld()).isZero();
        assertThat(ledger.entries()).anySatisfy(entry -> {
            assertThat(entry.id()).isEqualTo(give.id());
            assertThat(entry.voided()).isTrue();
        });
        assertThatThrownBy(() -> bottles.voidEntry(customer, UUID.fromString(give.id()), admin, new BottleLedgerDtos.Void(UUID.randomUUID(), "Lần hai")))
                .isInstanceOf(ConflictException.class);

        bottles.voidEntry(customer, UUID.fromString(collect.id()), admin, new BottleLedgerDtos.Void(UUID.randomUUID(), "Thu nhầm"));
        assertThat(bottles.ledger(customer).balance().depositHeld()).isZero();
    }

    // 6. Sửa đơn chờ xác nhận
    @Test
    void staffEditsPendingOrderAndTotalsFollowNewItems() throws Exception {
        long order = pendingOrder(customer, 2);
        long other = jdbc.queryForObject("INSERT INTO products(sku,name,unit,sale_price) VALUES (?,'Gap case','Thùng',120000) RETURNING id",
                Long.class, "GAP-" + UUID.randomUUID());
        var updated = orders.updatePending(order, new OrderUpdateRequest("Người nhận mới", "0907654321", "34 Lê Lợi", null, null,
                List.of(new OrderItemRequest(product, 1), new OrderItemRequest(other, 2)), "Đổi giờ"));
        assertThat(updated.recipientName()).isEqualTo("Người nhận mới");
        assertThat(updated.items()).hasSize(2);
        assertThat(updated.total()).isEqualByComparingTo("290000");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM order_items WHERE order_id=?", Integer.class, order)).isEqualTo(2);

        mvc.perform(put("/api/v1/sales/orders/" + order).with(user("sales").roles("SALES_STAFF")).contentType("application/json")
                .content("{\"recipientName\":\"A\",\"recipientPhone\":\"0901234567\",\"deliveryAddress\":\"B\",\"items\":[{\"productId\":" + product + ",\"quantity\":3}]}"))
                .andExpect(status().isOk());

        jdbc.update("UPDATE orders SET status='CONFIRMED' WHERE id=?", order);
        assertThatThrownBy(() -> orders.updatePending(order, new OrderUpdateRequest("A", "0901234567", "B", null, null,
                List.of(new OrderItemRequest(product, 1)), null))).isInstanceOf(ConflictException.class);
    }
}
