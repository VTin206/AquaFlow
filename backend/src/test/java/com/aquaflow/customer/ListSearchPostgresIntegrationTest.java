package com.aquaflow.customer;

import com.aquaflow.customer.api.dto.CustomerPageResponse;
import com.aquaflow.customer.api.dto.CustomerSummary;
import com.aquaflow.customer.application.CustomerService;
import com.aquaflow.customer.repository.CustomerQueryRepository;
import com.aquaflow.customer.order.api.dto.OrderListItem;
import com.aquaflow.customer.order.api.dto.OrderPageResponse;
import com.aquaflow.customer.order.application.OrderSearch;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.payment.PaymentDtos.Create;
import com.aquaflow.payment.PaymentService;
import com.aquaflow.shared.api.PageRequestParams;
import com.aquaflow.shared.api.SearchKeyword;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Câu SQL tìm/lọc/phân trang danh sách đơn và khách trên PostgreSQL thật (bỏ dấu tiếng Việt, số điện thoại,
 * ký tự đại diện LIKE, view order_payment_balances). Mỗi lần chạy dùng một mã riêng trong tên để không lẫn
 * với dữ liệu của test khác trong cùng database.
 */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class ListSearchPostgresIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private OrderService orderService;

    @Autowired
    private CustomerService customerService;

    @Autowired
    private PaymentService paymentService;

    private final Random random = new Random();
    private String tag;
    private long actor;
    private long product;
    private long duc;
    private long tran;
    private long completedOld;
    private long pendingToday;
    private long deliveredRecent;
    private long cancelledOld;
    private String pendingPhone;

    @BeforeEach
    void setUp() {
        tag = "zq" + random.ints(6, 'a', 'z' + 1).collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append);
        jdbc.update("INSERT INTO roles(code,name) VALUES ('ADMIN','Administrator') ON CONFLICT (code) DO NOTHING");
        actor = jdbc.queryForObject("INSERT INTO users(role_id,full_name,email,password_hash) VALUES "
                + "((SELECT id FROM roles WHERE code='ADMIN'),'List tester',?,'unused') RETURNING id", Long.class, tag + "@list.test");
        product = jdbc.queryForObject("INSERT INTO products (sku, name, unit, sale_price) VALUES (?, ?, 'Bình', 20000) RETURNING id",
                Long.class, "LST-" + tag, "Nước khoáng " + tag);
        duc = customer("Nguyễn Văn Đức " + tag);
        tran = customer("Trần Thị Hoa " + tag);

        OffsetDateTime now = OffsetDateTime.now();
        completedOld = order(duc, "DELIVERED", "DELIVERY", "Nguyễn Văn Đức " + tag, phone(), "12 Đường Số 3 " + tag, 100000, now.minusDays(40));
        jdbc.update("INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, 5, 20000, 100000)",
                completedOld, product);
        pay(completedOld, "100000");
        jdbc.update("UPDATE orders SET status = 'COMPLETED' WHERE id = ?", completedOld);
        cancelledOld = order(duc, "CANCELLED", "DELIVERY", "Nguyễn Văn Đức " + tag, phone(), null, 70000, now.minusDays(45));
        deliveredRecent = order(duc, "DELIVERED", "DELIVERY", "Nguyễn Văn Đức " + tag, phone(), "5 Lý Thường Kiệt " + tag, 80000, now.minusDays(2));
        pay(deliveredRecent, "30000");
        pendingPhone = phone();
        pendingToday = order(duc, "PENDING", "COUNTER", "Lê 100% " + tag, pendingPhone, "99 Lê Lợi " + tag, 50000, now.minusMinutes(5));
    }

    @AfterEach
    void tearDown() {
        List<Long> orders = List.of(completedOld, pendingToday, deliveredRecent, cancelledOld);
        for (Long order : orders) {
            jdbc.update("DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE order_id = ?)", order);
            jdbc.update("DELETE FROM payments WHERE order_id = ?", order);
            jdbc.update("DELETE FROM order_items WHERE order_id = ?", order);
            jdbc.update("DELETE FROM orders WHERE id = ?", order);
        }
        jdbc.update("DELETE FROM customers WHERE id IN (?, ?)", duc, tran);
        jdbc.update("DELETE FROM products WHERE id = ?", product);
    }

    @Test
    void searchIgnoresVietnameseAccentsCaseAndMatchesProductNames() {
        assertThat(orderIds(search("nguyen van duc " + tag))).containsExactly(deliveredRecent, completedOld, cancelledOld);
        assertThat(orderIds(search("  NGUYỄN   VĂN ĐỨC " + tag.toUpperCase()))).containsExactly(deliveredRecent, completedOld, cancelledOld);
        assertThat(orderIds(search("NUOC KHOANG " + tag))).containsExactly(completedOld);
    }

    @Test
    void searchTreatsLikeWildcardsLiterallyAndMatchesPhoneDigits() {
        assertThat(orderIds(search("le 100% " + tag))).containsExactly(pendingToday);
        assertThat(orderIds(search("le 1_0% " + tag))).isEmpty();
        assertThat(orderIds(search("le %" + tag))).isEmpty();
        // Số lưu dạng 0xxxxxxxxx, khách gõ +84 có dấu cách vẫn tìm thấy.
        String international = "+84 " + pendingPhone.substring(1, 4) + " " + pendingPhone.substring(4);
        assertThat(orderIds(search(international))).contains(pendingToday);
    }

    @Test
    void filtersCombineWithKeywordAndCancelledOrdersAreNeitherDueNorSettled() {
        assertThat(orderIds(filter(Set.of(OrderStatus.PENDING, OrderStatus.DELIVERED), null, null)))
                .containsExactly(pendingToday, deliveredRecent);
        assertThat(orderIds(filter(Set.of(), FulfillmentType.COUNTER, null))).containsExactly(pendingToday);
        assertThat(orderIds(filter(Set.of(), null, OrderSearch.PaymentFilter.DUE))).containsExactly(pendingToday, deliveredRecent);
        assertThat(orderIds(filter(Set.of(), null, OrderSearch.PaymentFilter.SETTLED))).containsExactly(completedOld);
    }

    @Test
    void pagesAreNewestFirstAndCarryBalancesAndStatusCounts() {
        OrderSearch byTag = new OrderSearch(null, null, null, SearchKeyword.of(tag));
        OrderPageResponse first = orderService.search(byTag, new PageRequestParams(0, 3));
        OrderPageResponse second = orderService.search(byTag, new PageRequestParams(1, 3));
        OrderPageResponse beyond = orderService.search(byTag, new PageRequestParams(5, 3));

        assertThat(orderIds(first)).containsExactly(pendingToday, deliveredRecent, completedOld);
        assertThat(orderIds(second)).containsExactly(cancelledOld);
        assertThat(beyond.items()).isEmpty();
        assertThat(first.total()).isEqualTo(4);
        assertThat(first.totalPages()).isEqualTo(2);
        assertThat(first.statusCounts()).containsKeys(OrderStatus.values());
        assertThat(first.statusCounts().get(OrderStatus.PENDING)).isPositive();

        OrderListItem delivered = first.items().get(1);
        assertThat(delivered.paid()).isEqualByComparingTo("30000");
        assertThat(delivered.due()).isEqualByComparingTo("50000");
        assertThat(first.items().get(2).order().items()).hasSize(1);
    }

    @Test
    void workingSetKeepsUnfinishedAndRecentOrdersOnly() {
        List<Long> ids = orderService.workingSet(30).stream().map(item -> item.order().id()).toList();

        assertThat(ids).contains(pendingToday, deliveredRecent).doesNotContain(completedOld, cancelledOld);
        assertThat(orderService.customerOrders(duc)).extracting(item -> item.order().id())
                .containsExactly(pendingToday, deliveredRecent, completedOld, cancelledOld);
    }

    @Test
    void customerSummariesCountNonCancelledOrdersAndPendingFreeDebt() {
        CustomerPageResponse page = customerService.search("nguyen van duc " + tag, null, null, new PageRequestParams(0, 20));

        assertThat(page.items()).hasSize(1);
        CustomerSummary summary = page.items().get(0);
        assertThat(summary.id()).isEqualTo(duc);
        assertThat(summary.orderCount()).isEqualTo(3);
        assertThat(summary.lastDeliveryAddress()).isEqualTo("99 Lê Lợi " + tag);
        // Đơn chờ xác nhận chưa tính vào công nợ, như /sales/customer-balances.
        assertThat(summary.due()).isEqualByComparingTo("50000");
        assertThat(page.totals().due()).isGreaterThanOrEqualTo(new BigDecimal("50000"));
        assertThat(page.totals().customers()).isGreaterThanOrEqualTo(2);

        assertThat(customerIds(customerService.search("99 le loi " + tag, null, null, new PageRequestParams(0, 20)))).containsExactly(duc);
        assertThat(customerIds(customerService.search("kh-" + String.format("%03d", duc), null, null, new PageRequestParams(0, 100))))
                .contains(duc);
        assertThat(customerService.findSummary(tran)).hasValueSatisfying(empty -> {
            assertThat(empty.orderCount()).isZero();
            assertThat(empty.lastOrderAt()).isNull();
            assertThat(empty.due()).isZero();
        });
    }

    @Test
    void idleFilterUsesLatestNonCancelledOrder() {
        assertThat(customerIds(customerService.search(tag, "never", null, new PageRequestParams(0, 20)))).containsExactly(tran);
        assertThat(customerIds(customerService.search(tag, "7", null, new PageRequestParams(0, 20)))).isEmpty();
        assertThat(customerIds(customerService.search(tag, "all", null, new PageRequestParams(0, 20)))).containsExactly(duc, tran);

        jdbc.update("UPDATE orders SET created_at = created_at - INTERVAL '20 days' WHERE id IN (?, ?)", pendingToday, deliveredRecent);
        assertThat(customerIds(customerService.search(tag, "14", null, new PageRequestParams(0, 20)))).containsExactly(duc);
        assertThat(customerIds(customerService.search(tag, "30", null, new PageRequestParams(0, 20)))).isEmpty();
    }

    @Test
    void customersSortByWhitelistedColumnsWithNeverOrderedAsSmallest() {
        assertThat(sorted(CustomerQueryRepository.SortField.ORDERS, true)).containsExactly(duc, tran);
        assertThat(sorted(CustomerQueryRepository.SortField.ORDERS, false)).containsExactly(tran, duc);
        assertThat(sorted(CustomerQueryRepository.SortField.LAST_ORDER, false)).containsExactly(tran, duc);
        assertThat(sorted(CustomerQueryRepository.SortField.LAST_ORDER, true)).containsExactly(duc, tran);
        assertThat(sorted(CustomerQueryRepository.SortField.DEBT, true)).containsExactly(duc, tran);
        assertThat(sorted(CustomerQueryRepository.SortField.NAME, true)).containsExactly(tran, duc);
    }

    private List<Long> sorted(CustomerQueryRepository.SortField field, boolean descending) {
        return customerIds(customerService.search(tag, null, new CustomerQueryRepository.Sort(field, descending), new PageRequestParams(0, 20)));
    }

    private OrderPageResponse search(String keyword) {
        return orderService.search(new OrderSearch(null, null, null, SearchKeyword.of(keyword)), new PageRequestParams(0, 20));
    }

    private OrderPageResponse filter(Set<OrderStatus> statuses, FulfillmentType fulfillment, OrderSearch.PaymentFilter payment) {
        return orderService.search(new OrderSearch(statuses, fulfillment, payment, SearchKeyword.of(tag)), new PageRequestParams(0, 20));
    }

    private static List<Long> orderIds(OrderPageResponse page) {
        return page.items().stream().map(item -> item.order().id()).toList();
    }

    private static List<Long> customerIds(CustomerPageResponse page) {
        return page.items().stream().map(CustomerSummary::id).toList();
    }

    private long customer(String name) {
        return jdbc.queryForObject("INSERT INTO customers (full_name, phone) VALUES (?, ?) RETURNING id", Long.class, name, phone());
    }

    private long order(long customer, String status, String fulfillment, String recipient, String phone, String address,
            int subtotal, OffsetDateTime createdAt) {
        return jdbc.queryForObject("""
                        INSERT INTO orders (order_code, customer_id, created_by, channel, fulfillment_type, status,
                                            recipient_name, recipient_phone, delivery_address, subtotal, created_at)
                        VALUES (?, ?, ?, 'COUNTER', ?, ?, ?, ?, ?, ?, ?) RETURNING id""",
                Long.class, "LST-" + UUID.randomUUID(), customer, actor, fulfillment, status, recipient, phone, address,
                subtotal, createdAt);
    }

    private void pay(long order, String amount) {
        paymentService.create(order, actor, new Create(UUID.randomUUID(), new BigDecimal(amount), "IN", "CASH", null, null));
    }

    private String phone() {
        return "09" + String.format("%08d", random.nextInt(100_000_000));
    }
}
