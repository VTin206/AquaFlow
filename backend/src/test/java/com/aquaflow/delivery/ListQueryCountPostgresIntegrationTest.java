package com.aquaflow.delivery;

import com.aquaflow.delivery.api.DeliveryDtos.TripResponse;
import com.aquaflow.delivery.application.DeliveryService;
import com.aquaflow.inventory.api.dto.PurchaseReceiptResponse;
import com.aquaflow.inventory.application.PurchaseReceiptService;
import com.aquaflow.shared.api.PageRequestParams;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Danh sách phiếu nhập và chuyến giao được tải lại thường xuyên, và database có thể ở xa (mỗi truy vấn là một lượt
 * đi về mạng). Số truy vấn phải giữ nguyên khi có thêm phiếu/chuyến, không tăng theo từng dòng (N+1).
 */
@SpringBootTest(properties = {
        "app.jwt.secret=test-test-test-test-test-test-test-test",
        "spring.jpa.properties.hibernate.generate_statistics=true"})
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class ListQueryCountPostgresIntegrationTest {

    @MockitoSpyBean
    private JdbcTemplate jdbc;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private PurchaseReceiptService receipts;

    @Autowired
    private DeliveryService delivery;

    private String tag;
    private long actor;
    private long supplier;
    private long product;

    @BeforeEach
    void setUp() {
        tag = UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("INSERT INTO roles(code,name) VALUES ('ADMIN','Administrator') ON CONFLICT (code) DO NOTHING");
        actor = jdbc.queryForObject("INSERT INTO users(role_id,full_name,email,password_hash) VALUES "
                + "((SELECT id FROM roles WHERE code='ADMIN'),'Counter',?,'unused') RETURNING id", Long.class, tag + "@count.test");
        supplier = jdbc.queryForObject("INSERT INTO suppliers(name) VALUES (?) RETURNING id", Long.class, "NCC " + tag);
        product = jdbc.queryForObject("INSERT INTO products(sku,name,unit,sale_price) VALUES (?,?,'Bình',20000) RETURNING id",
                Long.class, "CNT-" + tag, "Nước " + tag);
    }

    @Test
    void purchaseReceiptListUsesTheSameNumberOfQueriesForMoreReceipts() {
        receipt(3);
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        long few = statements(statistics, () -> receipts.page(null, PageRequestParams.of(0, 100)));

        for (int i = 0; i < 4; i++) receipt(3);
        var listed = new Object() { List<PurchaseReceiptResponse> value; };
        long many = statements(statistics, () -> listed.value = receipts.page(null, PageRequestParams.of(0, 100)).items());

        // Mã phiếu của trang, đếm tổng, nạp chi tiết, đếm theo trạng thái: không tăng theo số phiếu.
        assertThat(many).isEqualTo(few).isLessThanOrEqualTo(4);
        // Đủ dòng hàng, đúng lô của từng phiếu (nạp chung một truy vấn không làm lẫn hay lặp phiếu).
        var mine = listed.value.stream().filter(r -> r.supplierId().equals(supplier)).toList();
        assertThat(mine).hasSize(5).allSatisfy(r -> assertThat(r.items()).hasSize(3)
                .allSatisfy(item -> assertThat(item.lotCode()).startsWith("L" + tag + "-" + r.id() + "-")));
        assertThat(listed.value).doesNotHaveDuplicates();
    }

    @Test
    void tripListUsesTheSameNumberOfQueriesForMoreTripsAndStops() {
        // Lần đo đầu đã có cả hai loại chuyến (đã xếp hàng, chờ xếp hàng) để mọi truy vấn đều chạy.
        trip("COMPLETED", OffsetDateTime.now().minusDays(1), 2, true);
        trip("CREATED", OffsetDateTime.now().minusDays(1), 1, false);
        long few = jdbcCalls(() -> delivery.list(actor, true));

        long older = trip("COMPLETED", OffsetDateTime.now().minusDays(60), 3, true);
        long pending = trip("CREATED", OffsetDateTime.now().minusDays(90), 2, false);
        trip("IN_PROGRESS", OffsetDateTime.now().minusDays(2), 4, false);
        var listed = new Object() { List<TripResponse> value; };
        long many = jdbcCalls(() -> listed.value = delivery.list(actor, true));

        assertThat(many).isEqualTo(few);
        TripResponse old = listed.value.stream().filter(t -> t.id() == older).findFirst().orElseThrow();
        assertThat(old.orders()).hasSize(3).allSatisfy(stop -> assertThat(stop.items()).singleElement()
                .satisfies(line -> assertThat(line.lotCode()).isEqualTo("LOAD-" + tag + "-" + older)));
        assertThat(old.settlement()).isNotNull();
        assertThat(old.orders().getFirst().latestAttempt().attemptNo()).isEqualTo(2);
        // Chuyến chưa xuất phát chưa xếp hàng: hiện hàng theo phiếu xuất kho mới nhất của đơn.
        TripResponse waiting = listed.value.stream().filter(t -> t.id() == pending).findFirst().orElseThrow();
        assertThat(waiting.orders()).allSatisfy(stop -> assertThat(stop.items()).singleElement()
                .satisfies(line -> assertThat(line.lotCode()).isEqualTo("NEW-" + tag)));
        assertThat(waiting.settlement()).isNull();

        // Gần đây: chuyến chưa xong luôn có, chuyến xong từ 60 ngày trước thì không.
        var recent = delivery.list(actor, true, null, 30).stream().map(TripResponse::id).toList();
        assertThat(recent).contains(pending).doesNotContain(older);
        // Theo đơn: đúng chuyến chở đơn đó, kể cả chuyến cũ.
        long order = old.orders().get(1).orderId();
        assertThat(delivery.list(actor, true, order, null)).extracting(TripResponse::id).containsExactly(older);
    }

    // ---- Dữ liệu ----

    private void receipt(int lines) {
        long receipt = jdbc.queryForObject("INSERT INTO purchase_receipts(supplier_id,status,created_by) VALUES (?,'DRAFT',?) RETURNING id",
                Long.class, supplier, actor);
        for (int i = 0; i < lines; i++) {
            long batch = batch("L" + tag + "-" + receipt + "-" + i);
            jdbc.update("INSERT INTO purchase_items(receipt_id,product_id,batch_id,quantity_received,quantity_accepted,unit_cost) VALUES (?,?,?,5,5,1000)",
                    receipt, product, batch);
        }
    }

    private long batch(String lot) {
        return jdbc.queryForObject("INSERT INTO product_batches(product_id,lot_code,expires_on) VALUES (?,?,?) RETURNING id",
                Long.class, product, lot, LocalDate.now().plusYears(1));
    }

    /** Chuyến có `stops` điểm giao; `loaded`: đã xếp hàng (có kết quả giao, bàn giao), không thì chỉ có phiếu xuất. */
    private long trip(String status, OffsetDateTime at, int stops, boolean loaded) {
        long trip = jdbc.queryForObject("""
                INSERT INTO delivery_trips(driver_name,status,created_by,created_at,started_at,ended_at)
                VALUES ('Tài xế',?,?,?,?,?) RETURNING id
                """, Long.class, status, actor, at, "CREATED".equals(status) ? null : at,
                "COMPLETED".equals(status) ? at : null);
        long loadBatch = loaded ? batch("LOAD-" + tag + "-" + trip) : 0;
        for (int i = 0; i < stops; i++) {
            long order = jdbc.queryForObject("""
                    INSERT INTO orders(order_code,created_by,channel,fulfillment_type,status,subtotal)
                    VALUES (?,?,'PHONE','DELIVERY',?,20000) RETURNING id
                    """, Long.class, "T" + UUID.randomUUID().toString().substring(0, 8), actor,
                    loaded ? "DELIVERED" : "OUT_FOR_DELIVERY");
            long item = jdbc.queryForObject("INSERT INTO order_items(order_id,product_id,quantity,unit_price,line_total) VALUES (?,?,1,20000,20000) RETURNING id",
                    Long.class, order, product);
            long assignment = jdbc.queryForObject("INSERT INTO delivery_assignments(trip_id,order_id) VALUES (?,?) RETURNING id",
                    Long.class, trip, order);
            if (loaded) {
                jdbc.update("INSERT INTO delivery_load_items(assignment_id,order_item_id,batch_id,quantity_loaded,quantity_delivered) VALUES (?,?,?,1,1)",
                        assignment, item, loadBatch);
                jdbc.update("INSERT INTO delivery_attempts(assignment_id,attempt_no,outcome,failure_reason) VALUES (?,1,'FAILED','Vắng nhà')", assignment);
                jdbc.update("INSERT INTO delivery_attempts(assignment_id,attempt_no,outcome,recipient_name) VALUES (?,2,'SUCCESS','Khách')", assignment);
            } else {
                // Phiếu xuất cũ rồi phiếu mới hơn: chỉ phiếu mới nhất được hiện.
                dispatch(order, item, "OLD-" + tag, at.minusHours(2));
                dispatch(order, item, "NEW-" + tag, at.minusHours(1));
            }
        }
        if (loaded) jdbc.update("INSERT INTO handover_records(trip_id,received_by) VALUES (?,?)", trip, actor);
        return trip;
    }

    private void dispatch(long order, long item, String lot, OffsetDateTime at) {
        long batch = batch(lot + "-" + UUID.randomUUID().toString().substring(0, 6));
        long dispatch = jdbc.queryForObject("INSERT INTO order_dispatches(order_id,performed_by,dispatched_at,order_status) VALUES (?,?,?,'OUT_FOR_DELIVERY') RETURNING id",
                Long.class, order, actor, at);
        jdbc.update("INSERT INTO order_dispatch_items(dispatch_id,order_item_id,product_id,batch_id,lot_code,expires_on,quantity) VALUES (?,?,?,?,?,?,1)",
                dispatch, item, product, batch, lot, LocalDate.now().plusYears(1));
    }

    private static long statements(Statistics statistics, Runnable action) {
        statistics.clear();
        action.run();
        return statistics.getPrepareStatementCount();
    }

    /** Số lần gọi JdbcTemplate (kể cả các lần gọi nội bộ giữa các hàm của nó): chỉ dùng để so sánh hai lần đo. */
    private long jdbcCalls(Supplier<?> action) {
        Mockito.clearInvocations(jdbc);
        action.get();
        return Mockito.mockingDetails(jdbc).getInvocations().size();
    }
}
