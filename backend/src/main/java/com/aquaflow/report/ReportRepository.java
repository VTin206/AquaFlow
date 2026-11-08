package com.aquaflow.report;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Map;

@Repository
public class ReportRepository {
    private final NamedParameterJdbcTemplate jdbc;
    public ReportRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc=jdbc; }
    public record Page(List<Map<String,Object>> content,int page,int size,long totalElements) {}
    // Counter dispatch is the authoritative delivery event for existing counter orders.
    private static final String ORDERS="""
        WITH filtered AS (
          SELECT o.*, COALESCE(o.delivered_at, CASE WHEN o.fulfillment_type='COUNTER' THEN d.dispatched_at END) AS sold_at
          FROM orders o LEFT JOIN LATERAL (
            SELECT dispatched_at FROM order_dispatches d0 WHERE d0.order_id=o.id
            ORDER BY d0.dispatched_at DESC, d0.id DESC LIMIT 1
          ) d ON TRUE
          WHERE (:channel IS NULL OR o.channel=:channel) AND (:method IS NULL OR o.fulfillment_type=:method)
        ), sold AS (
          SELECT * FROM filtered WHERE status IN ('DELIVERED','COMPLETED') AND sold_at>=:start AND sold_at<:end
        ), returns AS (
          SELECT r.id,r.order_id,r.created_at,COALESCE(SUM(ri.quantity*oi.unit_price *
            CASE WHEN o.subtotal>0 THEN (o.subtotal-o.discount_amount)/o.subtotal ELSE 1 END),0) AS amount
          FROM order_returns r JOIN filtered o ON o.id=r.order_id
          JOIN order_return_items ri ON ri.return_id=r.id JOIN order_items oi ON oi.id=ri.order_item_id
          WHERE r.created_at>=:start AND r.created_at<:end AND o.status IN ('DELIVERED','COMPLETED')
          GROUP BY r.id,r.order_id,r.created_at
        ), cash AS (
          SELECT p.* FROM payments p JOIN filtered o ON o.id=p.order_id
          WHERE p.status='CONFIRMED' AND p.confirmed_at>=:start AND p.confirmed_at<:end
        )
        """;
    public Map<String,Object> summary(MapSqlParameterSource p) {
        return jdbc.queryForMap(ORDERS+"""
          SELECT (SELECT COUNT(*) FROM filtered WHERE created_at>=:start AND created_at<:end) AS "ordersCreated",
            (SELECT COUNT(*) FROM filtered WHERE cancelled_at>=:start AND cancelled_at<:end) AS "ordersCancelled",
            COUNT(*) AS "ordersDelivered", COALESCE(SUM(subtotal),0) AS "goods",
            COALESCE(SUM(discount_amount),0) AS "discounts",COALESCE(SUM(delivery_fee),0) AS "deliveryFees",
            (SELECT COALESCE(SUM(amount),0) FROM returns) AS "returnsValue",
            COALESCE(SUM(subtotal-discount_amount),0)-(SELECT COALESCE(SUM(amount),0) FROM returns) AS "revenue",
            ROUND(CASE WHEN COUNT(*)=0 THEN 0 ELSE
              (COALESCE(SUM(subtotal-discount_amount),0)-(SELECT COALESCE(SUM(amount),0) FROM returns))/COUNT(*) END,2) AS "averageOrderValue",
            (SELECT COUNT(*) FROM customers c WHERE c.created_at>=:start AND c.created_at<:end) AS "newCustomers",
            (SELECT COALESCE(SUM(amount) FILTER(WHERE direction='IN' AND method='CASH'),0) FROM cash) AS "cashIn",
            (SELECT COALESCE(SUM(amount) FILTER(WHERE direction='IN' AND method='BANK_TRANSFER'),0) FROM cash) AS "transferIn",
            (SELECT COALESCE(SUM(amount) FILTER(WHERE direction='OUT'),0) FROM cash) AS "refunds",
            (SELECT COALESCE(SUM(CASE WHEN direction='IN' THEN amount ELSE -amount END),0) FROM cash) AS "netPayments",
            (SELECT COUNT(*) FROM filtered WHERE status IN ('DELIVERED','COMPLETED') AND sold_at IS NULL) AS "undatedDeliveredOrders"
          FROM sold
          """,p);
    }
    public List<Map<String,Object>> daily(MapSqlParameterSource p) {
        return jdbc.queryForList(ORDERS+"""
          , events AS (
            SELECT (sold_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, subtotal-discount_amount AS revenue,0::numeric AS collected,0 AS orders FROM sold
            UNION ALL SELECT (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,-amount,0,0 FROM returns
            UNION ALL SELECT (confirmed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,0,CASE WHEN direction='IN' THEN amount ELSE -amount END,0 FROM cash
            UNION ALL SELECT (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,0,0,1 FROM filtered WHERE created_at>=:start AND created_at<:end
          )
          SELECT to_char(d.day,'YYYY-MM-DD') AS date,COALESCE(SUM(e.revenue),0) AS revenue,
            COALESCE(SUM(e.collected),0) AS collected,COALESCE(SUM(e.orders),0) AS orders
          FROM generate_series(CAST(:fromDate AS date),CAST(:toDate AS date),INTERVAL '1 day') d(day)
          LEFT JOIN events e ON e.day=d.day::date GROUP BY d.day ORDER BY d.day
          """,p);
    }
    public List<Map<String,Object>> channels(MapSqlParameterSource p) {
        return jdbc.queryForList(ORDERS+"""
          SELECT c.channel,
            (SELECT COUNT(*) FROM filtered f WHERE f.channel=c.channel AND f.created_at>=:start AND f.created_at<:end) AS orders,
            (SELECT COALESCE(SUM(subtotal-discount_amount),0) FROM sold s WHERE s.channel=c.channel)
              -(SELECT COALESCE(SUM(r.amount),0) FROM returns r JOIN filtered f ON f.id=r.order_id WHERE f.channel=c.channel) AS revenue
          FROM (VALUES ('WEB'),('COUNTER'),('PHONE'),('MESSAGE')) c(channel)
          WHERE (:channel IS NULL OR c.channel=:channel) ORDER BY c.channel
          """,p);
    }
    public Map<String,Object> deposits(MapSqlParameterSource p) {
        return jdbc.queryForMap("""
          SELECT COALESCE(SUM(amount) FILTER(WHERE direction IN ('COLLECT','ADJUST_COLLECT') AND created_at>=:start),0) AS collected,
            COALESCE(SUM(amount) FILTER(WHERE direction IN ('REFUND','ADJUST_REFUND') AND entry_kind IS DISTINCT FROM 'LOSS' AND created_at>=:start),0) AS refunded,
            COALESCE(SUM(amount) FILTER(WHERE entry_kind='LOSS' AND created_at>=:start),0) AS forfeited,
            COALESCE(SUM(CASE WHEN direction IN ('COLLECT','ADJUST_COLLECT') THEN amount ELSE -amount END),0) AS held,
            (SELECT COALESCE(SUM(CASE WHEN movement IN ('GIVE','ADJUST_GIVE') THEN quantity ELSE -quantity END),0) FROM bottle_transactions WHERE occurred_at<:end) AS "bottlesHeld"
          FROM deposit_transactions WHERE created_at<:end
          """,p);
    }
    public Map<String,Object> receipts(MapSqlParameterSource p) {
        return jdbc.queryForMap("""
          SELECT COUNT(DISTINCT pr.id) AS count,COALESCE(SUM(pi.quantity_accepted*pi.unit_cost),0) AS value,
            COALESCE(SUM(pi.quantity_received-pi.quantity_accepted),0) AS damaged
          FROM purchase_receipts pr LEFT JOIN purchase_items pi ON pi.receipt_id=pr.id
          WHERE pr.status='CONFIRMED' AND pr.confirmed_at>=:start AND pr.confirmed_at<:end
          """,p);
    }
    public Page products(MapSqlParameterSource p,int page,int size) {
        String sql=ORDERS+"""
          , lines AS (
            SELECT oi.product_id,oi.quantity AS sold,0 AS returned,
              oi.line_total * CASE WHEN o.subtotal>0 THEN (o.subtotal-o.discount_amount)/o.subtotal ELSE 1 END AS revenue
            FROM order_items oi JOIN sold o ON o.id=oi.order_id
            UNION ALL
            SELECT oi.product_id,0,ri.quantity,-ri.quantity*oi.unit_price *
              CASE WHEN o.subtotal>0 THEN (o.subtotal-o.discount_amount)/o.subtotal ELSE 1 END
            FROM returns r JOIN filtered o ON o.id=r.order_id JOIN order_return_items ri ON ri.return_id=r.id
            JOIN order_items oi ON oi.id=ri.order_item_id
          )
          SELECT p.id AS "productId",p.sku,p.name,p.unit,SUM(l.sold) AS sold,SUM(l.returned) AS returned,
            ROUND(SUM(l.revenue),2) AS revenue
          FROM lines l JOIN products p ON p.id=l.product_id GROUP BY p.id
          """;
        return page(sql,"revenue DESC, \"productId\"",p,page,size);
    }
    public Page inventory(MapSqlParameterSource p,int page,int size) {
        String sql="""
          WITH moves AS (
            SELECT b.product_id,m.*,CASE WHEN movement_type IN ('DISPATCH','COUNTER_SALE','ADJUST_DOWN') THEN -quantity ELSE quantity END AS signed
            FROM inventory_movements m JOIN product_batches b ON b.id=m.batch_id
          ), movement_totals AS (
            SELECT product_id,
              COALESCE(SUM(signed) FILTER(WHERE occurred_at>=:end),0) AS after_period,
              COALESCE(SUM(signed) FILTER(WHERE occurred_at>=:start AND occurred_at<:end),0) AS during,
              COALESCE(SUM(quantity) FILTER(WHERE occurred_at>=:start AND occurred_at<:end AND movement_type='RECEIVE'),0) AS received,
              COALESCE(SUM(quantity) FILTER(WHERE occurred_at>=:start AND occurred_at<:end AND movement_type='RETURN'),0) AS restocked,
              COALESCE(SUM(quantity) FILTER(WHERE occurred_at>=:start AND occurred_at<:end AND movement_type IN ('DISPATCH','COUNTER_SALE')),0) AS issued,
              COALESCE(SUM(signed) FILTER(WHERE occurred_at>=:start AND occurred_at<:end AND movement_type IN ('ADJUST_UP','ADJUST_DOWN')),0) AS adjustments
            FROM moves GROUP BY product_id
          ), balances AS (
            SELECT b.product_id,SUM(i.on_hand) AS on_hand FROM inventory_balances i JOIN product_batches b ON b.id=i.batch_id GROUP BY b.product_id
          ), damaged AS (
            SELECT pi.product_id,SUM(pi.quantity_received-pi.quantity_accepted) AS quantity FROM purchase_items pi JOIN purchase_receipts pr ON pr.id=pi.receipt_id
            WHERE pr.status='CONFIRMED' AND pr.confirmed_at>=:start AND pr.confirmed_at<:end GROUP BY pi.product_id
          ), discarded AS (
            SELECT oi.product_id,SUM(rl.quantity-rl.sellable) AS quantity FROM inventory_return_lines rl
            JOIN inventory_returns r ON r.id=rl.return_id JOIN delivery_load_items li ON li.id=rl.load_item_id JOIN order_items oi ON oi.id=li.order_item_id
            WHERE r.created_at>=:start AND r.created_at<:end GROUP BY oi.product_id
          )
          SELECT p.id AS "productId",p.sku,p.name,p.unit,
            COALESCE(b.on_hand,0)-COALESCE(m.after_period,0)-COALESCE(m.during,0) AS opening,
            COALESCE(m.received,0) AS received,COALESCE(m.restocked,0) AS restocked,COALESCE(m.issued,0) AS issued,
            COALESCE(m.adjustments,0) AS adjustments,COALESCE(b.on_hand,0)-COALESCE(m.after_period,0) AS closing,
            COALESCE(d.quantity,0) AS damaged,COALESCE(x.quantity,0) AS discarded
          FROM products p LEFT JOIN balances b ON b.product_id=p.id LEFT JOIN movement_totals m ON m.product_id=p.id
          LEFT JOIN damaged d ON d.product_id=p.id LEFT JOIN discarded x ON x.product_id=p.id
          WHERE b.product_id IS NOT NULL OR m.product_id IS NOT NULL OR d.product_id IS NOT NULL OR x.product_id IS NOT NULL
          """;
        return page(sql,"issued DESC, \"productId\"",p,page,size);
    }
    public Page delivery(MapSqlParameterSource p,int page,int size) {
        String sql=ORDERS+"""
          , attempts AS (
            SELECT t.driver_id,COUNT(*) FILTER(WHERE da.outcome='SUCCESS') AS delivered,
              COUNT(*) FILTER(WHERE da.outcome='FAILED') AS failed,
              COUNT(*) FILTER(WHERE da.outcome='SUCCESS' AND o.requested_delivery_at IS NOT NULL) AS appointed,
              COUNT(*) FILTER(WHERE da.outcome='SUCCESS' AND da.attempted_at>o.requested_delivery_at) AS late
            FROM delivery_attempts da JOIN delivery_assignments a ON a.id=da.assignment_id JOIN delivery_trips t ON t.id=a.trip_id
            JOIN filtered o ON o.id=a.order_id WHERE da.attempted_at>=:start AND da.attempted_at<:end GROUP BY t.driver_id
          ), handovers AS (
            SELECT driver_id,COUNT(*) AS trips,SUM(cash_reported) AS reported,SUM(cash_confirmed) AS confirmed
            FROM handover_records WHERE handed_over_at>=:start AND handed_over_at<:end GROUP BY driver_id
          ), ids AS (SELECT driver_id FROM attempts UNION SELECT driver_id FROM handovers)
          SELECT COALESCE(ids.driver_id,0) AS "driverId",COALESCE(u.full_name,'Chưa phân công') AS driver,
            COALESCE(a.delivered,0) AS delivered,COALESCE(a.failed,0) AS failed,COALESCE(a.appointed,0) AS appointed,COALESCE(a.late,0) AS late,
            COALESCE(h.trips,0) AS "settledTrips",COALESCE(h.reported,0) AS "cashReported",COALESCE(h.confirmed,0) AS "cashConfirmed",
            COALESCE(h.reported-h.confirmed,0) AS "cashDifference"
          FROM ids LEFT JOIN users u ON u.id=ids.driver_id LEFT JOIN attempts a ON a.driver_id IS NOT DISTINCT FROM ids.driver_id
          LEFT JOIN handovers h ON h.driver_id IS NOT DISTINCT FROM ids.driver_id
          """;
        return page(sql,"delivered DESC, \"driverId\"",p,page,size);
    }
    public Page customers(MapSqlParameterSource p,int page,int size) {
        String sql=ORDERS+"""
          , events AS (
            SELECT id,customer_id,subtotal-discount_amount AS revenue,1 AS orders FROM sold
            UNION ALL SELECT o.id,o.customer_id,-r.amount,0 FROM returns r JOIN filtered o ON o.id=r.order_id
          )
          SELECT CASE WHEN e.customer_id IS NULL THEN 'guest' ELSE e.customer_id::text END AS key,
            COALESCE(c.full_name,'Khách vãng lai') AS name, SUM(e.orders) AS orders,ROUND(SUM(e.revenue),2) AS revenue
          FROM events e LEFT JOIN customers c ON c.id=e.customer_id GROUP BY e.customer_id,c.full_name
          """;
        return page(sql,"revenue DESC,key",p,page,size);
    }
    private Page page(String sql,String order,MapSqlParameterSource p,int page,int size) {
        long count=jdbc.queryForObject("SELECT COUNT(*) FROM ("+sql+") report",p,Long.class);
        p.addValue("limit",size).addValue("offset",(long)page*size);
        return new Page(jdbc.queryForList(sql+" ORDER BY "+order+" LIMIT :limit OFFSET :offset",p),page,size,count);
    }
}
