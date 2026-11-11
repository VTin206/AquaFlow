package com.aquaflow.workspace.repository;

import com.aquaflow.workspace.api.StoreSettingsData;
import com.aquaflow.workspace.api.StoreSettingsResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class StoreSettingsRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public StoreSettingsRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public StoreSettingsResponse get() {
        return jdbc.queryForObject("SELECT settings, version, updated_at, updated_by FROM store_settings WHERE id = 1",
                (rs, row) -> new StoreSettingsResponse(decode(rs.getString("settings")), rs.getLong("version"),
                        rs.getTimestamp("updated_at").toInstant(), rs.getObject("updated_by", Long.class)));
    }

    /** Phí giao đang áp dụng; cài đặt cũ chưa có mục này thì dùng mức mặc định. */
    public com.aquaflow.workspace.api.DeliveryFees deliveryFees() {
        return get().settings().deliveryFees();
    }

    public int defaultLowStock() {
        return jdbc.queryForObject("SELECT COALESCE((settings->>'defaultLowStock')::integer,10) FROM store_settings WHERE id=1",Integer.class);
    }

    public boolean update(StoreSettingsData data, long version, long actorId) {
        return jdbc.update("""
                UPDATE store_settings SET settings = CAST(? AS jsonb), version = version + 1,
                    updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = 1 AND version = ?
                """, encode(data), actorId, version) == 1;
    }

    public void audit(StoreSettingsData before, StoreSettingsData after, long actorId) {
        jdbc.update("""
                INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, before_json, after_json)
                VALUES (?, 'UPDATE', 'STORE_SETTINGS', 1, CAST(? AS jsonb), CAST(? AS jsonb))
                """, actorId, encode(before), encode(after));
    }

    private StoreSettingsData decode(String json) {
        try {
            StoreSettingsData data = mapper.readValue(json, StoreSettingsData.class);
            return data.deliveryFees() == null ? data.withDeliveryFees(com.aquaflow.workspace.api.DeliveryFees.DEFAULT) : data;
        }
        catch (JsonProcessingException e) { throw new IllegalStateException("Invalid stored settings", e); }
    }

    private String encode(StoreSettingsData data) {
        try { return mapper.writeValueAsString(data); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Cannot serialize settings", e); }
    }
}
