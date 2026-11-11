package com.aquaflow.payment;

import com.aquaflow.payment.PaymentDtos.*;
import com.aquaflow.shared.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import java.util.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Repository
public class PaymentRepository {
    private final JdbcTemplate jdbc;
    public PaymentRepository(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    private static final RowMapper<Balance> BALANCE = (r,n) -> new Balance(r.getLong("order_id"),r.getString("order_code"),
            r.getObject("customer_id",Long.class),r.getString("status"),r.getBigDecimal("total"),r.getBigDecimal("received"),
            r.getBigDecimal("refunded"),r.getBigDecimal("paid"),r.getBigDecimal("due"),r.getBigDecimal("refund_due"));
    private static final String RECEIPTS = """
        SELECT p.*, sale.amount AS sale_amount, u.full_name AS actor_name,
          CASE WHEN EXISTS(SELECT 1 FROM delivery_collections d WHERE d.payment_id=p.id) THEN 'DELIVERY' ELSE 'SALES' END AS source
        FROM payments p JOIN users u ON u.id=p.recorded_by
        JOIN LATERAL (SELECT SUM(a.amount) AS amount FROM payment_allocations a WHERE a.payment_id=p.id AND a.allocation_type='SALE') sale ON sale.amount>0
        """;
    private static final RowMapper<Receipt> RECEIPT = (r,n) -> new Receipt(r.getLong("id"),r.getLong("order_id"),r.getBigDecimal("sale_amount"),
            r.getString("direction"),r.getString("method"),r.getString("external_reference"),r.getString("note"),r.getLong("recorded_by"),
            r.getString("actor_name"),r.getObject("created_at",OffsetDateTime.class),r.getString("source"));
    public void lockOrder(long id) {
        if (jdbc.queryForList("SELECT id FROM orders WHERE id=? FOR UPDATE",Long.class,id).isEmpty()) throw new NotFoundException("Không tìm thấy đơn hàng");
    }
    public Balance balance(long id) {
        return jdbc.query("SELECT * FROM order_payment_balances WHERE order_id=?",BALANCE,id).stream().findFirst()
                .orElseThrow(() -> new NotFoundException("Không tìm thấy đơn hàng"));
    }
    public List<Balance> balances() { return jdbc.query("SELECT * FROM order_payment_balances ORDER BY order_id DESC",BALANCE); }
    public List<Balance> receivables(long customerId) {
        if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM customers WHERE id=?)",Boolean.class,customerId)))
            throw new NotFoundException("Không tìm thấy khách hàng");
        return jdbc.query("SELECT * FROM order_payment_balances WHERE customer_id=? AND status<>'PENDING' AND (due>0 OR refund_due>0) ORDER BY order_id",BALANCE,customerId);
    }
    /**
     * Khách còn phải thu hoặc cần hoàn tiền (kể cả hồ sơ đã lưu trữ), nhiều tiền nhất trước.
     * Không tính đơn chờ xác nhận. {@code keyword}: tìm theo tên hoặc số điện thoại.
     */
    public PageResponse<CustomerBalance> customerBalances(SearchKeyword keyword, PageRequestParams page) {
        var named = new org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate(jdbc);
        var params = new org.springframework.jdbc.core.namedparam.MapSqlParameterSource();
        String source = """
            FROM (SELECT c.id,c.full_name,c.phone,c.active,SUM(b.due) AS due,SUM(b.refund_due) AS refund_due
                  FROM customers c JOIN order_payment_balances b ON b.customer_id=c.id AND b.status<>'PENDING'
                  GROUP BY c.id,c.full_name,c.phone,c.active
                  HAVING SUM(b.due)>0 OR SUM(b.refund_due)>0) s
            """ + (keyword == null ? "" : " WHERE " + keyword.condition("s.full_name", "s.phone", params));
        long total = named.queryForObject("SELECT COUNT(*) " + source, params, Long.class);
        if (total == 0 || page.offset() >= total) return PageResponse.of(List.of(), page, total);
        params.addValue("limit", page.size()).addValue("offset", page.offset());
        return PageResponse.of(named.query("SELECT s.* " + source + " ORDER BY s.due DESC,s.refund_due DESC,s.id LIMIT :limit OFFSET :offset",
                params, (r,n)->new CustomerBalance(r.getLong("id"),r.getString("full_name"),r.getBoolean("active"),r.getBigDecimal("due"),r.getBigDecimal("refund_due"))),
                page, total);
    }
    public List<Receipt> receipts(long id) {
        return jdbc.query(RECEIPTS+" WHERE p.order_id=? AND p.status='CONFIRMED' ORDER BY p.id DESC",RECEIPT,id);
    }
    public Receipt detail(long orderId,long id) {
        return jdbc.query(RECEIPTS+" WHERE p.order_id=? AND p.id=?",RECEIPT,orderId,id).stream().findFirst().orElseThrow(()->new NotFoundException("Không tìm thấy phiếu thanh toán"));
    }
    public Optional<Receipt> replay(long orderId,long actor,Create input) {
        var existing=jdbc.query(RECEIPTS+" WHERE p.request_id=?",RECEIPT,input.requestId()).stream().findFirst();
        existing.ifPresent(p -> {
            if (p.orderId()!=orderId || p.recordedBy()!=actor || p.amount().compareTo(input.amount())!=0
                    || !p.direction().equals(input.direction()) || !p.method().equals(input.method()) || !Objects.equals(p.reference(),input.reference()) || !Objects.equals(p.note(),input.note()))
                throw new ConflictException("Mã yêu cầu đã dùng cho nội dung khác. Hãy tải lại dữ liệu.");
        });
        return existing;
    }
    public Receipt create(long orderId,long actor,Create input) {
        Long id=jdbc.queryForObject("""
            INSERT INTO payments(order_id,direction,method,amount,status,external_reference,note,recorded_by,confirmed_by,confirmed_at,request_id)
            VALUES (?,?,?,?,'CONFIRMED',?,?,?,?,NOW(),?) RETURNING id
            """,Long.class,orderId,input.direction(),input.method(),input.amount(),input.reference(),input.note(),actor,actor,input.requestId());
        jdbc.update("INSERT INTO payment_allocations(payment_id,allocation_type,amount) VALUES (?,'SALE',?)",id,input.amount());
        jdbc.queryForObject("SELECT refresh_order_payment_status(?)",Object.class,orderId);
        return detail(orderId,id);
    }
}
