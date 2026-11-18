package com.aquaflow.customer.order;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Các API mở khóa tính năng trên PostgreSQL thật, qua HTTP để kiểm cả phân quyền và nhật ký:
 * trả hàng sau giao, nhật ký theo đơn, mở lại (NCC, loại vỏ, sản phẩm, khách), loại nước và dung tích.
 */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class UnlockedFeaturesPostgresIntegrationTest {

    private static final String PASSWORD = "correct-password";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper json;

    private String tag;
    private long admin;
    private String adminToken;
    private String staffToken;
    private long product;
    private long freshBatch;

    @BeforeEach
    void setUp() throws Exception {
        tag = UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("INSERT INTO roles(code,name) VALUES ('ADMIN','Administrator'),('SALES_STAFF','Sales') ON CONFLICT (code) DO NOTHING");
        admin = user("ADMIN");
        adminToken = login(tag + "-ADMIN@unlock.test");
        user("SALES_STAFF");
        staffToken = login(tag + "-SALES_STAFF@unlock.test");
        product = jdbc.queryForObject("INSERT INTO products(sku,name,unit,sale_price) VALUES (?,?,'Bình',20000) RETURNING id",
                Long.class, "UNL-" + tag, "Nước khoáng " + tag);
        freshBatch = batch("FRESH-" + tag, LocalDate.now().plusYears(1), 10);
    }

    // ---- Trả hàng sau giao ----

    @Test
    void returnReducesOrderValueRefundsOverpaymentRestocksTheLotAndIsLoggedOnTheOrder() throws Exception {
        long[] order = deliveredCounterOrder(5, 10000, freshBatch);
        pay(order[0], "90000");

        JsonNode created = body(send(post("/api/v1/sales/orders/" + order[0] + "/returns"), adminToken,
                returnRequest(UUID.randomUUID(), order[1], 2, true, Map.of("method", "CASH")))
                .andExpect(status().isCreated()));
        // 2 × 20.000 × (100.000 - 10.000) / 100.000: giảm giá chia đều theo giá trị hàng.
        assertThat(created.get("value").decimalValue()).isEqualByComparingTo("36000");
        assertThat(created.get("refunded").decimalValue()).isEqualByComparingTo("36000");
        assertThat(created.get("restocked").asBoolean()).isTrue();
        assertThat(created.get("refundPaymentId").isNumber()).isTrue();

        var balance = jdbc.queryForMap("SELECT total, paid, due, refund_due, returned FROM order_payment_balances WHERE order_id=?", order[0]);
        assertThat((BigDecimal) balance.get("total")).isEqualByComparingTo("54000");
        assertThat((BigDecimal) balance.get("paid")).isEqualByComparingTo("54000");
        assertThat((BigDecimal) balance.get("due")).isEqualByComparingTo("0");
        assertThat((BigDecimal) balance.get("refund_due")).isEqualByComparingTo("0");
        assertThat((BigDecimal) balance.get("returned")).isEqualByComparingTo("36000");
        assertThat(jdbc.queryForObject("SELECT payment_status FROM orders WHERE id=?", String.class, order[0])).isEqualTo("PAID");
        // Nhập lại đúng lô khách đã nhận.
        assertThat(onHand(freshBatch)).isEqualTo(10 - 5 + 2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movements WHERE movement_type='RETURN' AND reference_id=? AND batch_id=?",
                Integer.class, order[0], freshBatch)).isEqualTo(1);

        JsonNode summary = body(send(get("/api/v1/sales/orders/" + order[0] + "/returns"), staffToken, null).andExpect(status().isOk()));
        assertThat(summary.at("/returns/0/lines/0/quantity").asInt()).isEqualTo(2);
        assertThat(summary.at("/items/0/returnable").asInt()).isEqualTo(3);

        JsonNode list = body(send(get("/api/v1/sales/orders/" + order[0] + "/activity"), staffToken, null).andExpect(status().isOk()));
        assertThat(list.findValuesAsText("action")).contains("receive", "paymentIn", "paymentOut");
        assertThat(list.findValuesAsText("actorName")).contains("Tester " + tag + " ADMIN");
        // Cũ trước mới sau.
        assertThat(list.get(0).get("action").asText()).isEqualTo("paymentIn");
    }

    @Test
    void resendingTheSameReturnDoesNotTakeGoodsBackOrRefundTwice() throws Exception {
        long[] order = deliveredCounterOrder(5, 0, freshBatch);
        pay(order[0], "100000");
        UUID requestId = UUID.randomUUID();
        String request = returnRequest(requestId, order[1], 1, true, Map.of("method", "CASH"));

        long first = body(send(post("/api/v1/sales/orders/" + order[0] + "/returns"), adminToken, request)
                .andExpect(status().isCreated())).get("id").asLong();
        long second = body(send(post("/api/v1/sales/orders/" + order[0] + "/returns"), adminToken, request)
                .andExpect(status().isCreated())).get("id").asLong();

        assertThat(second).isEqualTo(first);
        assertThat(onHand(freshBatch)).isEqualTo(10 - 5 + 1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM payments WHERE order_id=? AND direction='OUT'", Integer.class, order[0])).isEqualTo(1);
        // Cùng mã yêu cầu nhưng nội dung khác.
        send(post("/api/v1/sales/orders/" + order[0] + "/returns"), adminToken,
                returnRequest(requestId, order[1], 2, true, Map.of("method", "CASH"))).andExpect(status().isConflict());
    }

    @Test
    void overpaidReturnWithoutRefundMethodIsRejectedAndLeavesNothingBehind() throws Exception {
        long[] order = deliveredCounterOrder(5, 0, freshBatch);
        pay(order[0], "100000");

        send(post("/api/v1/sales/orders/" + order[0] + "/returns"), adminToken, returnRequest(UUID.randomUUID(), order[1], 1, true, null))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("20.000")));
        send(post("/api/v1/sales/orders/" + order[0] + "/returns"), adminToken,
                returnRequest(UUID.randomUUID(), order[1], 1, true, Map.of("method", "BANK_TRANSFER")))
                .andExpect(status().isBadRequest());

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM order_returns WHERE order_id=?", Integer.class, order[0])).isZero();
        assertThat(onHand(freshBatch)).isEqualTo(5);
    }

    @Test
    void unpaidReturnOnlyLowersWhatIsDueAndDamagedGoodsStayOutOfStock() throws Exception {
        long[] order = deliveredCounterOrder(5, 0, freshBatch);

        send(post("/api/v1/sales/orders/" + order[0] + "/returns"), adminToken, returnRequest(UUID.randomUUID(), order[1], 5, false, null))
                .andExpect(status().isCreated());

        var balance = jdbc.queryForMap("SELECT due, refund_due FROM order_payment_balances WHERE order_id=?", order[0]);
        assertThat((BigDecimal) balance.get("due")).isEqualByComparingTo("0");
        assertThat((BigDecimal) balance.get("refund_due")).isEqualByComparingTo("0");
        // Trả hết hàng thì không còn gì phải thu.
        assertThat(jdbc.queryForObject("SELECT payment_status FROM orders WHERE id=?", String.class, order[0])).isEqualTo("PAID");
        assertThat(onHand(freshBatch)).isEqualTo(5);
        // Đã trả hết thì không trả thêm được.
        send(post("/api/v1/sales/orders/" + order[0] + "/returns"), adminToken, returnRequest(UUID.randomUUID(), order[1], 1, false, null))
                .andExpect(status().isConflict());
    }

    @Test
    void expiredLotCannotBeRestocked() throws Exception {
        long expired = batch("OLD-" + tag, LocalDate.now().minusDays(1), 3);
        long[] order = deliveredCounterOrder(2, 0, expired);

        send(post("/api/v1/sales/orders/" + order[0] + "/returns"), adminToken, returnRequest(UUID.randomUUID(), order[1], 1, true, null))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("hết hạn")));
        send(post("/api/v1/sales/orders/" + order[0] + "/returns"), adminToken, returnRequest(UUID.randomUUID(), order[1], 1, false, null))
                .andExpect(status().isCreated());
    }

    @Test
    void onlyTheOwnerTakesReturnsAndOnlyForDeliveredOrders() throws Exception {
        long[] order = deliveredCounterOrder(2, 0, freshBatch);
        send(post("/api/v1/sales/orders/" + order[0] + "/returns"), staffToken, returnRequest(UUID.randomUUID(), order[1], 1, false, null))
                .andExpect(status().isForbidden());

        jdbc.update("UPDATE orders SET status='CONFIRMED' WHERE id=?", order[0]);
        send(post("/api/v1/sales/orders/" + order[0] + "/returns"), adminToken, returnRequest(UUID.randomUUID(), order[1], 1, false, null))
                .andExpect(status().isConflict());
        send(get("/api/v1/sales/orders/999999999/activity"), staffToken, null).andExpect(status().isNotFound());
    }

    // ---- Mở lại ----

    @Test
    void retiredRecordsCanBeBroughtBack() throws Exception {
        long supplier = jdbc.queryForObject("INSERT INTO suppliers(name,active) VALUES (?,FALSE) RETURNING id", Long.class, "NCC " + tag);
        send(post("/api/v1/suppliers/" + supplier + "/reactivate"), staffToken, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));

        long bottle = jdbc.queryForObject("INSERT INTO bottle_types(name,deposit_unit_amount,active) VALUES (?,50000,FALSE) RETURNING id",
                Long.class, "Vỏ " + tag);
        long bottled = jdbc.queryForObject("INSERT INTO products(sku,name,unit,sale_price,bottle_type_id,active) VALUES (?,?,'Bình',20000,?,FALSE) RETURNING id",
                Long.class, "BOT-" + tag, "Bình " + tag, bottle);
        // Loại vỏ còn ngừng thì chưa bán lại sản phẩm được.
        send(post("/api/v1/products/" + bottled + "/reactivate"), staffToken, null).andExpect(status().isConflict());
        send(post("/api/v1/bottle-types/" + bottle + "/reactivate"), staffToken, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
        send(post("/api/v1/products/" + bottled + "/reactivate"), staffToken, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
        // Gọi lại khi đang hoạt động không lỗi.
        send(post("/api/v1/products/" + bottled + "/reactivate"), staffToken, null).andExpect(status().isOk());
        send(post("/api/v1/products/999999999/reactivate"), staffToken, null).andExpect(status().isNotFound());
    }

    @Test
    void archivedCustomersAreListedAndRestoredUnlessTheirPhoneIsTaken() throws Exception {
        String phone = "09" + String.format("%08d", Math.abs(tag.hashCode()) % 100_000_000);
        long archived = jdbc.queryForObject("INSERT INTO customers(full_name,phone,active) VALUES (?,?,FALSE) RETURNING id",
                Long.class, "Khách cũ " + tag, phone);
        long taken = jdbc.queryForObject("INSERT INTO customers(full_name,phone,active) VALUES (?,?,TRUE) RETURNING id",
                Long.class, "Khách mới " + tag, phone);

        JsonNode list = body(send(get("/api/v1/sales/customers/archived"), staffToken, null).andExpect(status().isOk()));
        assertThat(list.findValuesAsText("fullName")).contains("Khách cũ " + tag).doesNotContain("Khách mới " + tag);

        send(post("/api/v1/sales/customers/" + archived + "/reactivate"), staffToken, null).andExpect(status().isConflict());
        jdbc.update("UPDATE customers SET active=FALSE WHERE id=?", taken);
        send(post("/api/v1/sales/customers/" + archived + "/reactivate"), staffToken, null).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT active FROM customers WHERE id=?", Boolean.class, archived)).isTrue();
        send(post("/api/v1/sales/customers/999999999/reactivate"), staffToken, null).andExpect(status().isNotFound());
    }

    // ---- Loại sản phẩm và dung tích ----

    @Test
    void categoryAndVolumeAreSavedKeptWhenOmittedAndCleared() throws Exception {
        String sku = "CAT-" + tag;
        long category = jdbc.queryForObject("INSERT INTO product_categories(name) VALUES (?) RETURNING id", Long.class, "Ion kiềm " + tag);
        long id = body(send(post("/api/v1/products"), staffToken, json.writeValueAsString(Map.of(
                "sku", sku, "name", "Nước ion kiềm " + tag, "unit", "Thùng", "salePrice", 90000,
                "categoryId", category, "volumeMl", 500))).andExpect(status().isCreated())
                .andExpect(jsonPath("$.categoryId").value(category)).andExpect(jsonPath("$.categoryName").value("Ion kiềm " + tag))
                .andExpect(jsonPath("$.volumeMl").value(500))).get("id").asLong();

        // Client cũ không gửi hai field này: giữ nguyên.
        send(put("/api/v1/products/" + id), staffToken, json.writeValueAsString(Map.of("name", "Nước ion kiềm " + tag, "unit", "Thùng", "salePrice", 95000)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.categoryId").value(category)).andExpect(jsonPath("$.volumeMl").value(500));
        // Danh mục công khai trả tên loại để trang khách lọc.
        mvc.perform(get("/api/v1/products/" + id)).andExpect(status().isOk()).andExpect(jsonPath("$.categoryName").value("Ion kiềm " + tag));
        send(put("/api/v1/products/" + id), staffToken, json.writeValueAsString(Map.of("name", "Nước ion kiềm " + tag, "unit", "Thùng",
                "salePrice", 95000, "categoryId", 0, "volumeMl", 0)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.categoryId").isEmpty()).andExpect(jsonPath("$.volumeMl").isEmpty());

        send(put("/api/v1/products/" + id), staffToken, json.writeValueAsString(Map.of("name", "X", "unit", "Thùng", "salePrice", 1, "categoryId", -1)))
                .andExpect(status().isBadRequest());
        send(put("/api/v1/products/" + id), staffToken, json.writeValueAsString(Map.of("name", "X", "unit", "Thùng", "salePrice", 1, "volumeMl", 100001)))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/products/" + id)).andExpect(status().isOk()).andExpect(jsonPath("$.volumeMl").isEmpty());
    }

    // ---- Dữ liệu ----

    private long user(String role) {
        return jdbc.queryForObject("INSERT INTO users(role_id,full_name,email,password_hash) VALUES "
                        + "((SELECT id FROM roles WHERE code=?),?,?,?) RETURNING id",
                Long.class, role, "Tester " + tag + " " + role, tag + "-" + role + "@unlock.test", passwordEncoder.encode(PASSWORD));
    }

    private String login(String email) throws Exception {
        String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("accessToken").asText();
    }

    private long batch(String lot, LocalDate expiresOn, int onHand) {
        long id = jdbc.queryForObject("INSERT INTO product_batches(product_id,lot_code,expires_on) VALUES (?,?,?) RETURNING id",
                Long.class, product, lot, expiresOn);
        jdbc.update("INSERT INTO inventory_balances(batch_id,on_hand) VALUES (?,?)", id, onHand);
        return id;
    }

    /** Đơn bán tại quầy đã xuất kho từ một lô: {orderId, orderItemId}. */
    private long[] deliveredCounterOrder(int quantity, int discount, long batch) {
        int subtotal = quantity * 20000;
        long order = jdbc.queryForObject("""
                INSERT INTO orders(order_code,created_by,channel,fulfillment_type,status,subtotal,discount_amount,delivered_at)
                VALUES (?,?,'COUNTER','COUNTER','DELIVERED',?,?,NOW()) RETURNING id
                """, Long.class, "R" + UUID.randomUUID().toString().substring(0, 8), admin, subtotal, discount);
        long item = jdbc.queryForObject("INSERT INTO order_items(order_id,product_id,quantity,unit_price,line_total) VALUES (?,?,?,20000,?) RETURNING id",
                Long.class, order, product, quantity, subtotal);
        long dispatch = jdbc.queryForObject("INSERT INTO order_dispatches(order_id,performed_by,order_status) VALUES (?,?,'DELIVERED') RETURNING id",
                Long.class, order, admin);
        var lot = jdbc.queryForMap("SELECT lot_code, expires_on FROM product_batches WHERE id=?", batch);
        jdbc.update("INSERT INTO order_dispatch_items(dispatch_id,order_item_id,product_id,batch_id,lot_code,expires_on,quantity) VALUES (?,?,?,?,?,?,?)",
                dispatch, item, product, batch, lot.get("lot_code"), lot.get("expires_on"), quantity);
        jdbc.update("UPDATE inventory_balances SET on_hand=on_hand-? WHERE batch_id=?", quantity, batch);
        jdbc.queryForObject("SELECT refresh_order_payment_status(?)", Object.class, order);
        return new long[]{order, item};
    }

    private void pay(long order, String amount) throws Exception {
        send(post("/api/v1/sales/orders/" + order + "/payments"), adminToken, json.writeValueAsString(Map.of(
                "requestId", UUID.randomUUID(), "amount", new BigDecimal(amount), "direction", "IN", "method", "CASH")))
                .andExpect(status().is2xxSuccessful());
    }

    private String returnRequest(UUID requestId, long item, int quantity, boolean restock, Map<String, String> refund) throws Exception {
        var request = new java.util.LinkedHashMap<String, Object>();
        request.put("requestId", requestId);
        request.put("reason", "Khách đổi ý " + tag);
        request.put("restock", restock);
        request.put("lines", java.util.List.of(Map.of("orderItemId", item, "quantity", quantity)));
        if (refund != null) request.put("refund", refund);
        return json.writeValueAsString(request);
    }

    private int onHand(long batch) {
        return jdbc.queryForObject("SELECT on_hand FROM inventory_balances WHERE batch_id=?", Integer.class, batch);
    }

    private ResultActions send(MockHttpServletRequestBuilder request, String token, String body) throws Exception {
        request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(body);
        return mvc.perform(request);
    }

    private JsonNode body(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }
}
