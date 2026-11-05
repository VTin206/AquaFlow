package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.api.dto.InventoryMovementResponse;
import com.aquaflow.inventory.domain.MovementType;
import com.aquaflow.inventory.domain.MovementReferenceType;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

@Repository
public class InventoryMovementReadRepository {
    private final NamedParameterJdbcTemplate jdbc;
    public InventoryMovementReadRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    private static final String SOURCE = """
            FROM inventory_movements m
            JOIN product_batches b ON b.id = m.batch_id
            JOIN products p ON p.id = b.product_id
            JOIN users u ON u.id = m.performed_by
            LEFT JOIN orders o ON m.reference_type = 'ORDER' AND o.id = m.reference_id
            """;
    private static final String SELECT = """
            SELECT m.*, p.id AS product_id, p.name AS product_name, p.sku, p.unit,
                   b.lot_code, b.expires_on, u.full_name AS actor_name,
                   CASE WHEN m.reference_type = 'PURCHASE_RECEIPT'
                        THEN 'PN-' || lpad(m.reference_id::text, greatest(5, length(m.reference_id::text)), '0')
                        ELSE COALESCE(o.order_code, 'Đơn #' || m.reference_id::text) END AS reference_code
            """;
    private static final RowMapper<InventoryMovementResponse> MAPPER = (rs, row) -> {
        MovementType type = MovementType.valueOf(rs.getString("movement_type"));
        int quantity = rs.getInt("quantity");
        boolean outbound = type == MovementType.DISPATCH || type == MovementType.COUNTER_SALE || type == MovementType.ADJUST_DOWN;
        return new InventoryMovementResponse(rs.getLong("id"), type, quantity, outbound ? -quantity : quantity,
                rs.getTimestamp("occurred_at").toInstant(), rs.getLong("product_id"), rs.getString("product_name"),
                rs.getString("sku"), rs.getString("unit"), rs.getLong("batch_id"), rs.getString("lot_code"),
                rs.getDate("expires_on").toLocalDate(), MovementReferenceType.valueOf(rs.getString("reference_type")),
                rs.getLong("reference_id"), rs.getString("reference_code"), rs.getLong("performed_by"),
                rs.getString("actor_name"), rs.getString("reason"));
    };

    public record Result(List<InventoryMovementResponse> content, long totalElements) {}

    public Result list(MovementType type, Long productId, Instant from, Instant to, String query, int page, int size) {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        MapSqlParameterSource params = new MapSqlParameterSource();
        if (type != null) { where.append(" AND m.movement_type = :type"); params.addValue("type", type.name()); }
        if (productId != null) { where.append(" AND p.id = :productId"); params.addValue("productId", productId); }
        if (from != null) { where.append(" AND m.occurred_at >= :from"); params.addValue("from", Timestamp.from(from)); }
        if (to != null) { where.append(" AND m.occurred_at < :to"); params.addValue("to", Timestamp.from(to)); }
        if (query != null && !query.isBlank()) {
            where.append(" AND strpos(lower(concat_ws(' ', p.name, p.sku, b.lot_code, o.order_code, m.reference_id::text, u.full_name, CASE WHEN m.reference_type = 'PURCHASE_RECEIPT' THEN 'PN-' || lpad(m.reference_id::text, greatest(5, length(m.reference_id::text)), '0') END)), lower(:q)) > 0");
            params.addValue("q", query.trim());
        }
        long total = jdbc.queryForObject("SELECT COUNT(*) " + SOURCE + where, params, Long.class);
        params.addValue("limit", size).addValue("offset", (long) page * size);
        var content = jdbc.query(SELECT + SOURCE + where + " ORDER BY m.occurred_at DESC, m.id DESC LIMIT :limit OFFSET :offset", params, MAPPER);
        return new Result(content, total);
    }

    public Optional<InventoryMovementResponse> find(long id) {
        return jdbc.query(SELECT + SOURCE + " WHERE m.id = :id", new MapSqlParameterSource("id", id), MAPPER).stream().findFirst();
    }
}
