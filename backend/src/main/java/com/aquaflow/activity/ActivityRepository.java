package com.aquaflow.activity;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.stereotype.Repository;
import com.aquaflow.shared.api.NotFoundException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

@Repository
public class ActivityRepository {
    private final NamedParameterJdbcTemplate jdbc;
    public ActivityRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Entry(long id, Instant at, Long actorId, String actorName, String area,
                        String action, String entityType, Long entityId, String target, String reason) {}
    public record Actor(long id, String name) {}
    public record Page(List<Entry> content, int page, int size, long totalElements) {}
    private static final String SOURCE = """
        FROM (SELECT a.*, CASE
          WHEN entity_type IN ('ORDER','ORDER_RETURN') THEN 'ORDERS'
          WHEN entity_type IN ('DELIVERY_TRIP','DELIVERY_ASSIGNMENT') THEN 'DELIVERY'
          WHEN entity_type IN ('CUSTOMER','CUSTOMER_ADDRESS') THEN 'CUSTOMERS'
          WHEN entity_type = 'SUPPLIER' THEN 'SUPPLIERS'
          WHEN entity_type = 'STORE_SETTINGS' THEN 'SETTINGS'
          WHEN entity_type IN ('PRODUCT','BOTTLE_TYPE','PURCHASE_RECEIPT','DISPATCH','INVENTORY_RETURN') THEN 'INVENTORY'
          ELSE 'OTHER' END AS area FROM audit_logs a) a
        LEFT JOIN users u ON u.id=a.actor_id
        LEFT JOIN orders o ON a.entity_type='ORDER' AND o.id=a.entity_id
        """;
    private static final String SELECT = """
        SELECT a.*, COALESCE(u.full_name,'Hệ thống / khách vãng lai') AS actor_name,
          COALESCE(o.order_code, a.entity_type || COALESCE(' #' || a.entity_id::text,'')) AS target
        """;
    private static final org.springframework.jdbc.core.RowMapper<Entry> MAPPER = (rs,n) -> new Entry(
        rs.getLong("id"), rs.getTimestamp("created_at").toInstant(), rs.getObject("actor_id",Long.class),
        rs.getString("actor_name"), rs.getString("area"), rs.getString("action"), rs.getString("entity_type"),
        rs.getObject("entity_id",Long.class), rs.getString("target"), rs.getString("reason"));

    public Page list(String area, Long actorId, Instant from, Instant to, String q, int page, int size) {
        var params = new MapSqlParameterSource();
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        if(area!=null) { where.append(" AND a.area=:area"); params.addValue("area",area); }
        if(actorId!=null) { where.append(" AND a.actor_id=:actor"); params.addValue("actor",actorId); }
        if(from!=null) { where.append(" AND a.created_at>=:from"); params.addValue("from",Timestamp.from(from)); }
        if(to!=null) { where.append(" AND a.created_at<:to"); params.addValue("to",Timestamp.from(to)); }
        if(q!=null && !q.isBlank()) {
            where.append(" AND strpos(lower(concat_ws(' ',a.action,a.entity_type,a.entity_id::text,a.reason,u.full_name,o.order_code)),lower(:q))>0");
            params.addValue("q",q.trim());
        }
        long count=jdbc.queryForObject("SELECT COUNT(*) "+SOURCE+where,params,Long.class);
        params.addValue("limit",size).addValue("offset",(long)page*size);
        return new Page(jdbc.query(SELECT+SOURCE+where+" ORDER BY a.created_at DESC,a.id DESC LIMIT :limit OFFSET :offset",params,MAPPER),page,size,count);
    }
    public Entry get(long id) {
        return jdbc.query(SELECT+SOURCE+" WHERE a.id=:id",new MapSqlParameterSource("id",id),MAPPER)
            .stream().findFirst().orElseThrow(()->new NotFoundException("Không tìm thấy nhật ký"));
    }
    public List<Actor> actors() {
        return jdbc.query("SELECT u.id,u.full_name FROM users u WHERE EXISTS(SELECT 1 FROM audit_logs a WHERE a.actor_id=u.id) ORDER BY u.full_name,u.id",
            new MapSqlParameterSource(),(rs,n)->new Actor(rs.getLong(1),rs.getString(2)));
    }
    public void append(Long actor, String action, String entity, Long id, String reason) {
        append(actor,action,entity,id,reason,null);
    }
    public void append(Long actor, String action, String entity, Long id, String reason, Long orderId) {
        jdbc.update("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,reason,order_id) VALUES (:actor,:action,:entity,:id,:reason,:order)",
            new MapSqlParameterSource("actor",actor).addValue("action",action).addValue("entity",entity).addValue("id",id)
                .addValue("reason",reason).addValue("order",orderId));
    }

    /** Một mốc trong nhật ký của đơn: thao tác nghiệp vụ (ACTION) hoặc phiếu thu/hoàn tiền (PAYMENT). */
    public record OrderEntry(String kind, Instant at, Long actorId, String actorName, String action,
                             String description, String entityType, Long entityId) {}

    /** Nhật ký theo đơn, cũ trước mới sau; null khi không có đơn. Tối đa 500 mốc gần nhất. */
    public List<OrderEntry> forOrder(long orderId) {
        if(jdbc.queryForList("SELECT id FROM orders WHERE id=:id",new MapSqlParameterSource("id",orderId),Long.class).isEmpty())
            throw new NotFoundException("Không tìm thấy đơn hàng");
        return jdbc.query("""
            SELECT * FROM (
              SELECT 'ACTION' AS kind, a.created_at AS at, a.actor_id, u.full_name AS actor_name, a.action, a.reason AS description,
                     a.entity_type, a.entity_id, a.id AS seq
              FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id WHERE a.order_id=:id
              UNION ALL
              SELECT 'PAYMENT', COALESCE(p.confirmed_at,p.created_at), p.recorded_by, u.full_name,
                     CASE WHEN p.direction='IN' THEN 'paymentIn' ELSE 'paymentOut' END,
                     concat_ws(' · ', CASE WHEN p.direction='IN' THEN 'Thu tiền' ELSE 'Hoàn tiền' END,
                       to_char(sale.amount,'FM999G999G999G990') || ' ₫',
                       CASE WHEN p.method='CASH' THEN 'Tiền mặt' ELSE 'Chuyển khoản' END, p.external_reference, p.note),
                     'PAYMENT', p.id, p.id
              FROM payments p JOIN users u ON u.id=p.recorded_by
              JOIN LATERAL (SELECT SUM(x.amount) AS amount FROM payment_allocations x WHERE x.payment_id=p.id AND x.allocation_type='SALE') sale ON sale.amount>0
              WHERE p.order_id=:id AND p.status='CONFIRMED'
            ) e ORDER BY e.at DESC, e.kind, e.seq DESC LIMIT 500
            """,new MapSqlParameterSource("id",orderId),(rs,n)->new OrderEntry(rs.getString("kind"),rs.getTimestamp("at").toInstant(),
                rs.getObject("actor_id",Long.class),Objects.requireNonNullElse(rs.getString("actor_name"),"Hệ thống / khách vãng lai"),
                rs.getString("action"),rs.getString("description"),rs.getString("entity_type"),rs.getObject("entity_id",Long.class)))
            .reversed();
    }
}
