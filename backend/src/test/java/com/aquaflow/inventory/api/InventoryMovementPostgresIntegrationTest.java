package com.aquaflow.inventory.api;

import com.aquaflow.inventory.application.InventoryMovementService;
import com.aquaflow.inventory.domain.MovementType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@Transactional
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class InventoryMovementPostgresIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired InventoryMovementService service;
    @Autowired MockMvc mvc;
    long productId;
    long batchId;
    long actorId;
    long orderId;
    long receiptId;
    long receiveId;
    long dispatchId;
    long counterId;
    String code;
    static final String BASE = "/api/v1/inventory/movements";
    static final Instant START = Instant.parse("2026-11-03T00:00:00Z");

    @BeforeEach
    void setup() {
        code = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO roles(code, name) VALUES ('SALES_STAFF', 'Sales') ON CONFLICT (code) DO NOTHING");
        actorId = jdbc.queryForObject("INSERT INTO users(role_id, full_name, email, password_hash) VALUES ((SELECT id FROM roles WHERE code = 'SALES_STAFF'), 'Ledger actor', ?, 'unused') RETURNING id", Long.class, code + "@ledger.test");
        productId = jdbc.queryForObject("INSERT INTO products(sku, name, unit, sale_price, active) VALUES (?, 'Ledger water', 'Bình', 100, FALSE) RETURNING id", Long.class, code);
        batchId = jdbc.queryForObject("INSERT INTO product_batches(product_id, lot_code, expires_on) VALUES (?, 'LOT_100%', '2027-01-01') RETURNING id", Long.class, productId);
        orderId = jdbc.queryForObject("INSERT INTO orders(order_code, channel, fulfillment_type) VALUES (?, 'PHONE', 'DELIVERY') RETURNING id", Long.class, code);
        long supplierId = jdbc.queryForObject("INSERT INTO suppliers(name) VALUES ('Ledger supplier') RETURNING id", Long.class);
        receiptId = jdbc.queryForObject("INSERT INTO purchase_receipts(supplier_id, created_by, status) VALUES (?, ?, 'CONFIRMED') RETURNING id", Long.class, supplierId, actorId);
        receiveId = insert("RECEIVE", 10, "PURCHASE_RECEIPT", receiptId, START);
        dispatchId = insert("DISPATCH", 3, "ORDER", orderId, START.plusSeconds(3600));
        counterId = insert("COUNTER_SALE", 2, "ORDER", orderId, START.plusSeconds(3600));
    }

    long insert(String type, int quantity, String referenceType, long referenceId, Instant at) {
        return jdbc.queryForObject("""
                INSERT INTO inventory_movements(batch_id, movement_type, quantity, reference_type, reference_id, performed_by, occurred_at)
                VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
                """, Long.class, batchId, type, quantity, referenceType, referenceId, actorId, java.sql.Timestamp.from(at));
    }

    @Test
    void ledgerHasStablePaginationAndIncludesInactiveProducts() {
        var page = service.list(null, productId, null, null, null, 0, 1);
        assertThat(page.totalElements()).isEqualTo(3);
        assertThat(page.content()).hasSize(1);
        assertThat(page.content().getFirst().id()).isEqualTo(counterId);
        assertThat(page.content().getFirst().signedQuantity()).isEqualTo(-2);
        assertThat(service.list(null, productId, null, null, null, 1, 1).content().getFirst().id()).isEqualTo(dispatchId);
        var received = service.find(receiveId);
        assertThat(received.signedQuantity()).isEqualTo(10);
        assertThat(received.referenceCode()).isEqualTo("PN-" + String.format("%05d", receiptId));
        assertThat(received.performedByName()).isEqualTo("Ledger actor");
        assertThat(received.productName()).isEqualTo("Ledger water");
        assertThat(service.find(dispatchId).referenceCode()).isEqualTo(code);
    }

    @Test
    void filtersUseInclusiveFromExclusiveToAndLiteralSearch() {
        assertThat(service.list(null, productId, START, START.plusSeconds(3600), null, 0, 20).content())
                .extracting(r -> r.id()).containsExactly(receiveId);
        assertThat(service.list(MovementType.DISPATCH, productId, null, null, null, 0, 20).content())
                .extracting(r -> r.id()).containsExactly(dispatchId);
        assertThat(service.list(null, productId, null, null, "LOT_100%", 0, 20).totalElements()).isEqualTo(3);
        assertThat(service.list(null, productId, null, null, "PN-" + String.format("%05d", receiptId), 0, 20).content())
                .extracting(r -> r.id()).containsExactly(receiveId);
        assertThat(service.list(null, productId, null, null, "' OR 1=1 --", 0, 20).content()).isEmpty();
        assertThat(service.list(null, productId, null, null, null, 10, 20).content()).isEmpty();
    }

    @Test
    void allMovementDirectionsAreCorrect() {
        assertThat(service.find(insert("RETURN", 4, "ORDER", orderId, START)).signedQuantity()).isEqualTo(4);
        assertThat(service.find(insert("ADJUST_UP", 2, "ORDER", orderId, START)).signedQuantity()).isEqualTo(2);
        assertThat(service.find(insert("ADJUST_DOWN", 2, "ORDER", orderId, START)).signedQuantity()).isEqualTo(-2);
    }

    @Test
    void restPermissionsValidationAndDetailAreEnforced() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
        for (String role : new String[]{"CUSTOMER", "DELIVERY_STAFF"}) {
            mvc.perform(get(BASE).with(user("denied").roles(role))).andExpect(status().isForbidden());
            mvc.perform(get(BASE + "/" + receiveId).with(user("denied").roles(role))).andExpect(status().isForbidden());
        }
        mvc.perform(get(BASE).param("productId", Long.toString(productId)).with(user("sales").roles("SALES_STAFF")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].signedQuantity").value(-2));
        mvc.perform(get(BASE + "/" + receiveId).with(user("admin").roles("ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.quantity").value(10));
        mvc.perform(get(BASE + "/0").with(user("admin").roles("ADMIN"))).andExpect(status().isNotFound());
        mvc.perform(post(BASE).with(user("admin").roles("ADMIN")).contentType("application/json").content("{}"))
                .andExpect(status().isMethodNotAllowed()).andExpect(header().exists("Allow"));
        for (String[] invalid : new String[][]{{"page", "-1"}, {"size", "101"}, {"size", "0"}, {"productId", "0"}, {"type", "UNKNOWN"}, {"from", "yesterday"}}) {
            mvc.perform(get(BASE).param(invalid[0], invalid[1]).with(user("sales").roles("SALES_STAFF"))).andExpect(status().isBadRequest());
        }
        mvc.perform(get(BASE).param("from", START.toString()).param("to", START.toString()).with(user("sales").roles("SALES_STAFF")))
                .andExpect(status().isBadRequest());
        mvc.perform(get(BASE).param("productId", Long.toString(productId)).param("from", START.toString())
                .param("to", START.plusSeconds(3600).toString()).with(user("sales").roles("SALES_STAFF")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
    }
}
