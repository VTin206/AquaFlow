package com.aquaflow.workspace.repository;

/** A single database snapshot reconciles actionable conditions and preserves read history. */
final class OwnerAlertSql {
    private OwnerAlertSql() {}

    static final String RECONCILE = """
            WITH params AS (
                SELECT CAST(? AS date) AS today, CAST(? AS timestamptz) AS checked_at,
                    COALESCE((SELECT (settings->>'expiryWarningDays')::integer FROM store_settings WHERE id = 1), 30) AS warning_days
            ), open_orders AS (
                SELECT o.*, last_attempt.id AS attempt_id, last_attempt.outcome, last_attempt.failure_reason
                FROM orders o
                LEFT JOIN LATERAL (
                    SELECT a.id, a.outcome, a.failure_reason FROM delivery_attempts a
                    JOIN delivery_assignments da ON da.id = a.assignment_id
                    WHERE da.order_id = o.id AND da.active
                    ORDER BY a.attempted_at DESC, a.id DESC LIMIT 1
                ) last_attempt ON true
                WHERE o.status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY')
            ), product_stock AS (
                SELECT p.id, p.sku, p.name, p.low_stock_threshold,
                    COALESCE(SUM(CASE WHEN b.expires_on > params.today THEN ib.on_hand - ib.reserved ELSE 0 END), 0) AS available
                FROM products p CROSS JOIN params
                LEFT JOIN product_batches b ON b.product_id = p.id
                LEFT JOIN inventory_balances ib ON ib.batch_id = b.id
                WHERE p.active
                GROUP BY p.id
            ), candidates(kind, source_key, entity_type, entity_id, title, message) AS (
                SELECT 'ORDER_PENDING', 'ORDER_PENDING:' || id, 'ORDER', id,
                    'Đơn hàng chờ xác nhận', 'Đơn ' || order_code || ' đang chờ xác nhận.'
                FROM open_orders WHERE status = 'PENDING'
                UNION ALL
                SELECT 'ORDER_OVERDUE', 'ORDER_OVERDUE:' || id, 'ORDER', id,
                    'Đơn đã quá giờ hẹn', 'Đơn ' || order_code || ' đã quá giờ hẹn giao. Vui lòng kiểm tra và liên hệ khách.'
                FROM open_orders CROSS JOIN params
                WHERE fulfillment_type = 'DELIVERY' AND requested_delivery_at < params.checked_at
                    AND outcome IS DISTINCT FROM 'FAILED'
                UNION ALL
                SELECT 'DELIVERY_FAILED', 'DELIVERY_FAILED:' || attempt_id, 'ORDER', id,
                    'Giao hàng thất bại', 'Đơn ' || order_code || ': ' || LEFT(COALESCE(NULLIF(failure_reason, ''), 'Chưa ghi lý do'), 1500)
                FROM open_orders WHERE fulfillment_type = 'DELIVERY' AND outcome = 'FAILED'
                UNION ALL
                SELECT 'LOW_STOCK', 'LOW_STOCK:' || id, 'PRODUCT', id,
                    CASE WHEN available <= 0 THEN 'Sản phẩm hết hàng bán được' ELSE 'Sản phẩm sắp hết hàng' END,
                    sku || ' — ' || name || ': còn ' || available || ' có thể bán, ngưỡng cảnh báo ' || low_stock_threshold || '.'
                FROM product_stock WHERE available <= low_stock_threshold
                UNION ALL
                SELECT CASE WHEN b.expires_on <= params.today THEN 'BATCH_EXPIRED' ELSE 'BATCH_EXPIRING' END,
                    CASE WHEN b.expires_on <= params.today THEN 'BATCH_EXPIRED:' ELSE 'BATCH_EXPIRING:' END || b.id,
                    'BATCH', b.id,
                    CASE WHEN b.expires_on <= params.today THEN 'Lô hàng đã hết hạn' ELSE 'Lô hàng sắp hết hạn' END,
                    p.name || ' — lô ' || b.lot_code || ', HSD ' || to_char(b.expires_on, 'DD/MM/YYYY') || ', tồn thực tế ' || ib.on_hand || '.'
                FROM product_batches b JOIN products p ON p.id = b.product_id
                JOIN inventory_balances ib ON ib.batch_id = b.id CROSS JOIN params
                WHERE p.active AND ib.on_hand > 0 AND b.expires_on <= params.today + params.warning_days
            ), refreshed AS (
                INSERT INTO notifications(recipient_id, title, message, kind, entity_type, entity_id, source_key, created_at)
                SELECT u.id, c.title, c.message, c.kind, c.entity_type, c.entity_id, c.source_key, params.checked_at
                FROM candidates c CROSS JOIN params CROSS JOIN users u JOIN roles r ON r.id = u.role_id
                WHERE r.code = 'ADMIN' AND u.status = 'ACTIVE'
                ON CONFLICT (recipient_id, source_key) WHERE source_key IS NOT NULL AND resolved_at IS NULL
                DO UPDATE SET title = EXCLUDED.title, message = EXCLUDED.message
                RETURNING id
            )
            UPDATE notifications n SET resolved_at = params.checked_at
            FROM params WHERE n.source_key IS NOT NULL AND n.resolved_at IS NULL
                AND NOT EXISTS (SELECT 1 FROM refreshed WHERE refreshed.id = n.id)
            """;
}
