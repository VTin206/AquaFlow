package com.aquaflow.customer.order;

import com.aquaflow.customer.order.application.OrderSearch;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.shared.api.PageRequestParams;
import com.aquaflow.shared.api.SearchKeyword;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Danh sách đơn phân trang ở BE sắp theo mức ưu tiên xử lý, giống bảng Đơn hàng ở frontend:
 * giao thất bại → quá giờ hẹn → chờ xác nhận → đang xử lý → đã giao còn nợ → xong/hủy.
 */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
@Transactional
class OrderPriorityPostgresIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired OrderService orders;

    private final String tag = "prio" + UUID.randomUUID().toString().substring(0, 8);
    private final OffsetDateTime now = OffsetDateTime.now();
    private long actor;

    @BeforeEach
    void setUp() {
        jdbc.update("INSERT INTO roles(code,name) VALUES ('ADMIN','Administrator') ON CONFLICT (code) DO NOTHING");
        actor = jdbc.queryForObject("INSERT INTO users(role_id,full_name,email,password_hash) VALUES "
                + "((SELECT id FROM roles WHERE code='ADMIN'),'Priority tester',?,'unused') RETURNING id", Long.class, tag + "@prio.test");
    }

    @Test
    void sortsByPriorityThenByHowLongTheWorkHasWaited() {
        long cancelledOld = order("CANCELLED", "DELIVERY", now.minusDays(3), null);
        long cancelledNew = order("CANCELLED", "DELIVERY", now.minusDays(1), null);
        long deliveredDue = order("DELIVERED", "DELIVERY", now.minusDays(2), null);
        long activeNoTime = order("PREPARING", "DELIVERY", now.minusHours(4), null);
        long activeLater = order("CONFIRMED", "DELIVERY", now.minusHours(1), now.plusHours(5));
        long activeSoon = order("CONFIRMED", "DELIVERY", now.minusMinutes(20), now.plusHours(1));
        long pendingNew = order("PENDING", "COUNTER", now.minusMinutes(10), null);
        long pendingOld = order("PENDING", "COUNTER", now.minusHours(2), null);
        long overdueShort = order("PREPARING", "DELIVERY", now.minusHours(2), now.minusMinutes(30));
        long overdueLong = order("CONFIRMED", "DELIVERY", now.minusHours(6), now.minusHours(3));
        long failed = order("OUT_FOR_DELIVERY", "DELIVERY", now.minusMinutes(5), now.minusHours(5));
        failAttempt(failed);

        assertThat(ids(0, 20)).containsExactly(failed, overdueLong, overdueShort, pendingOld, pendingNew,
                activeSoon, activeLater, activeNoTime, deliveredDue, cancelledNew, cancelledOld);
        // Phân trang cắt đúng theo thứ tự ưu tiên.
        assertThat(ids(0, 3)).containsExactly(failed, overdueLong, overdueShort);
        assertThat(ids(1, 3)).containsExactly(pendingOld, pendingNew, activeSoon);
    }

    @Test
    void failedDeliveryOnlyCountsForTheActiveAssignment() {
        long reassigned = order("CONFIRMED", "DELIVERY", now.minusHours(1), now.plusHours(2));
        failAttempt(reassigned);
        jdbc.update("UPDATE delivery_assignments SET active = false WHERE order_id = ?", reassigned);
        long pending = order("PENDING", "COUNTER", now.minusMinutes(5), null);

        // Lần thất bại của phân công cũ không còn tính: đơn trở lại mức đang xử lý, sau đơn chờ xác nhận.
        assertThat(ids(0, 20)).containsExactly(pending, reassigned);
    }

    private List<Long> ids(int page, int size) {
        return orders.search(new OrderSearch(null, null, null, SearchKeyword.of(tag)), new PageRequestParams(page, size))
                .items().stream().map(item -> item.order().id()).toList();
    }

    private long order(String status, String fulfillment, OffsetDateTime createdAt, OffsetDateTime requestedAt) {
        return jdbc.queryForObject("""
                        INSERT INTO orders (order_code, created_by, channel, fulfillment_type, status, recipient_name,
                                            recipient_phone, delivery_address, subtotal, created_at, requested_delivery_at)
                        VALUES (?, ?, 'COUNTER', ?, ?, ?, '0900000000', '1 Đường A', 50000, ?, ?) RETURNING id""",
                Long.class, "PRIO-" + UUID.randomUUID(), actor, fulfillment, status, "Khách " + tag, createdAt, requestedAt);
    }

    private void failAttempt(long order) {
        long trip = jdbc.queryForObject("INSERT INTO delivery_trips(created_by) VALUES (?) RETURNING id", Long.class, actor);
        long assignment = jdbc.queryForObject("INSERT INTO delivery_assignments(trip_id, order_id) VALUES (?, ?) RETURNING id",
                Long.class, trip, order);
        jdbc.update("INSERT INTO delivery_attempts(assignment_id, attempt_no, outcome, failure_reason) VALUES (?, 1, 'FAILED', 'Khách vắng')",
                assignment);
    }
}
