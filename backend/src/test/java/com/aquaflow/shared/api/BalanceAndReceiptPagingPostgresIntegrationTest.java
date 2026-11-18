package com.aquaflow.shared.api;

import com.aquaflow.bottle.BottleLedgerService;
import com.aquaflow.inventory.api.dto.LotSourceResponse;
import com.aquaflow.inventory.application.PurchaseReceiptService;
import com.aquaflow.inventory.domain.PurchaseReceiptStatus;
import com.aquaflow.payment.PaymentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Công nợ theo khách, sổ vỏ theo khách và phiếu nhập phân trang ở SQL; nguồn nhập của lô gộp từ phiếu đã nhập kho. */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class BalanceAndReceiptPagingPostgresIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PaymentService payments;

    @Autowired
    private BottleLedgerService bottles;

    @Autowired
    private PurchaseReceiptService receipts;

    private String tag;
    private long actor;

    @BeforeEach
    void setUp() {
        tag = "pg" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("INSERT INTO roles(code,name) VALUES ('ADMIN','Administrator') ON CONFLICT (code) DO NOTHING");
        actor = jdbc.queryForObject("INSERT INTO users(role_id,full_name,email,password_hash) VALUES "
                + "((SELECT id FROM roles WHERE code='ADMIN'),'Pager',?,'unused') RETURNING id", Long.class, tag + "@page.test");
    }

    @Test
    void customerBalancesListOnlyCustomersWhoOweOrAreOwedLargestFirst() {
        long big = customerOwing("Nguyễn Văn Nợ Nhiều " + tag, "0901000001", 300000);
        long small = customerOwing("Trần Nợ Ít " + tag, "0901000002", 50000);
        customerOwing("Lê Đã Trả " + tag, "0901000003", 0);
        long archived = customerOwing("Phạm Lưu Trữ " + tag, "0901000004", 80000);
        jdbc.update("UPDATE customers SET active=FALSE WHERE id=?", archived);

        var all = payments.customers(tag, PageRequestParams.of(0, 10));
        assertThat(all.total()).isEqualTo(3);
        assertThat(all.items()).extracting(PaymentDtos_customerId()).containsExactly(big, archived, small);
        assertThat(all.items().get(1).active()).isFalse();

        var second = payments.customers(tag, PageRequestParams.of(1, 2));
        assertThat(second.items()).extracting(PaymentDtos_customerId()).containsExactly(small);
        assertThat(second.totalPages()).isEqualTo(2);
        // Tìm không dấu và theo số điện thoại.
        assertThat(payments.customers("no nhieu " + tag, PageRequestParams.of(0, 10)).items()).singleElement()
                .satisfies(row -> assertThat(row.customerId()).isEqualTo(big));
        assertThat(payments.customers("+84 901 000 002", PageRequestParams.of(0, 10)).items())
                .anySatisfy(row -> assertThat(row.customerId()).isEqualTo(small));
        assertThatThrownBy(() -> PageRequestParams.of(0, 101)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void bottleBalancesPageNewestCustomersFirstAndSearch() {
        long first = jdbc.queryForObject("INSERT INTO customers(full_name,phone) VALUES (?, '0902000001') RETURNING id", Long.class, "Vỏ Một " + tag);
        long second = jdbc.queryForObject("INSERT INTO customers(full_name,phone) VALUES (?, '0902000002') RETURNING id", Long.class, "Vỏ Hai " + tag);
        long third = jdbc.queryForObject("INSERT INTO customers(full_name,phone,active) VALUES (?, '0902000003',FALSE) RETURNING id", Long.class, "Vỏ Ba " + tag);

        var page = bottles.balances(tag, PageRequestParams.of(0, 2));
        assertThat(page.total()).isEqualTo(3);
        assertThat(page.items()).extracting(b -> b.customerId()).containsExactly(third, second);
        assertThat(bottles.balances(tag, PageRequestParams.of(1, 2)).items()).extracting(b -> b.customerId()).containsExactly(first);
        assertThat(bottles.balances("vo hai " + tag, PageRequestParams.of(0, 10)).items()).extracting(b -> b.customerId()).containsExactly(second);
    }

    @Test
    void receiptsPageByStatusWithCountsAndLotSourcesComeFromConfirmedReceipts() {
        long supplier = jdbc.queryForObject("INSERT INTO suppliers(name) VALUES (?) RETURNING id", Long.class, "NCC " + tag);
        long product = jdbc.queryForObject("INSERT INTO products(sku,name,unit,sale_price) VALUES (?,?,'Bình',1) RETURNING id",
                Long.class, "PG-" + tag, "Nước " + tag);
        long batch = jdbc.queryForObject("INSERT INTO product_batches(product_id,lot_code,manufactured_on,expires_on) VALUES (?,?,?,?) RETURNING id",
                Long.class, product, "LOT-" + tag, LocalDate.now().minusDays(10), LocalDate.now().plusYears(1));
        var before = receipts.page(null, PageRequestParams.of(0, 1)).statusCounts();
        long older = receipt(supplier, "CONFIRMED", OffsetDateTime.now().minusDays(3), product, batch, 10, 9000);
        long newer = receipt(supplier, "CONFIRMED", OffsetDateTime.now().minusDays(1), product, batch, 4, 9500);
        long draft = receipt(supplier, "DRAFT", OffsetDateTime.now(), product, batch, 7, 9900);

        var all = receipts.page(null, PageRequestParams.of(0, 100));
        // Ngày nhận mới nhất trước (so trong các phiếu của test này).
        assertThat(all.items()).extracting(r -> r.id()).filteredOn(id -> id == older || id == newer || id == draft)
                .containsExactly(draft, newer, older);
        assertThat(receipts.page(null, PageRequestParams.of(0, 1)).items()).hasSize(1);
        assertThat(all.items().stream().filter(r -> r.id() == draft).findFirst().orElseThrow().items()).singleElement().satisfies(item -> assertThat(item.lotCode()).isEqualTo("LOT-" + tag));
        assertThat(all.statusCounts().get(PurchaseReceiptStatus.CONFIRMED)).isEqualTo(before.get(PurchaseReceiptStatus.CONFIRMED) + 2);
        assertThat(all.statusCounts().get(PurchaseReceiptStatus.DRAFT)).isEqualTo(before.get(PurchaseReceiptStatus.DRAFT) + 1);
        assertThat(all.statusCounts()).containsKey(PurchaseReceiptStatus.CANCELLED);
        assertThat(receipts.page(PurchaseReceiptStatus.DRAFT, PageRequestParams.of(0, 100)).items()).extracting(r -> r.id())
                .contains(draft).doesNotContain(older, newer);

        // Phiếu nháp không tính; phiếu đầu tiên giữ giá vốn và ngày sản xuất, số lượng cộng dồn.
        LotSourceResponse source = receipts.lotSources().stream().filter(s -> s.batchId() == batch).findFirst().orElseThrow();
        assertThat(source.receiptId()).isEqualTo(older);
        assertThat(source.received()).isEqualTo(14);
        assertThat(source.unitCost()).isEqualByComparingTo("9000");
        assertThat(source.manufacturedOn()).isEqualTo(LocalDate.now().minusDays(10));
    }

    private long customerOwing(String name, String phone, int due) {
        long customer = jdbc.queryForObject("INSERT INTO customers(full_name,phone) VALUES (?,?) RETURNING id", Long.class, name, phone);
        long order = jdbc.queryForObject("""
                INSERT INTO orders(order_code,customer_id,created_by,channel,fulfillment_type,status,subtotal)
                VALUES (?,?,?,'COUNTER','COUNTER','DELIVERED',?) RETURNING id
                """, Long.class, "P" + UUID.randomUUID().toString().substring(0, 8), customer, actor, Math.max(due, 1000));
        if (due == 0) {
            long payment = jdbc.queryForObject("INSERT INTO payments(order_id,direction,method,amount,status,recorded_by) VALUES (?,'IN','CASH',1000,'CONFIRMED',?) RETURNING id",
                    Long.class, order, actor);
            jdbc.update("INSERT INTO payment_allocations(payment_id,allocation_type,amount) VALUES (?,'SALE',1000)", payment);
        }
        return customer;
    }

    private long receipt(long supplier, String status, OffsetDateTime receivedAt, long product, long batch, int accepted, int cost) {
        long receipt = jdbc.queryForObject("INSERT INTO purchase_receipts(supplier_id,status,received_at,created_by) VALUES (?,?,?,?) RETURNING id",
                Long.class, supplier, status, receivedAt, actor);
        jdbc.update("INSERT INTO purchase_items(receipt_id,product_id,batch_id,quantity_received,quantity_accepted,unit_cost) VALUES (?,?,?,?,?,?)",
                receipt, product, batch, accepted, accepted, cost);
        return receipt;
    }

    private static java.util.function.Function<com.aquaflow.payment.PaymentDtos.CustomerBalance, Long> PaymentDtos_customerId() {
        return com.aquaflow.payment.PaymentDtos.CustomerBalance::customerId;
    }
}
