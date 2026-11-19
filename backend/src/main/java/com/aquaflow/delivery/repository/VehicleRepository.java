package com.aquaflow.delivery.repository;

import com.aquaflow.shared.api.NotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Xe giao hàng và các truy vấn "đang bận" dùng khi xếp chuyến.
 * Bận: đang ở một chuyến chưa xuất phát, hoặc đang giao mà còn đơn chưa có kết quả.
 * Chuyến đã giao xong, chỉ còn chờ đối soát thì xe và tài xế coi như đã về, xếp chuyến mới được.
 */
@Repository
public class VehicleRepository {
    public record VehicleRow(Long id, String plate, String name, int capacity, boolean active) {}
    /** Chuyến đang giữ xe/tài xế. */
    public record BusyTrip(long tripId, String status) {}

    private static final RowMapper<VehicleRow> MAPPER = (rs, i) -> new VehicleRow(rs.getLong("id"),
            rs.getString("plate"), rs.getString("name"), rs.getInt("capacity_units"), rs.getBoolean("active"));

    /** Điều kiện SQL "chuyến t còn giữ người/xe", dùng chung cho xe và tài xế. */
    private static final String HOLDING_TRIP = """
            (t.status = 'CREATED' OR (t.status = 'IN_PROGRESS' AND EXISTS (
                SELECT 1 FROM delivery_assignments a WHERE a.trip_id = t.id AND a.active
                  AND NOT EXISTS (SELECT 1 FROM delivery_attempts da WHERE da.assignment_id = a.id))))
            """;

    private final JdbcTemplate jdbc;

    public VehicleRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<VehicleRow> list() {
        return jdbc.query("SELECT * FROM vehicles ORDER BY active DESC, plate, id", MAPPER);
    }

    public VehicleRow lock(long id) {
        return jdbc.query("SELECT * FROM vehicles WHERE id = ? FOR UPDATE", MAPPER, id).stream().findFirst()
                .orElseThrow(() -> new NotFoundException("Không tìm thấy xe"));
    }

    public Optional<VehicleRow> find(long id) {
        return jdbc.query("SELECT * FROM vehicles WHERE id = ?", MAPPER, id).stream().findFirst();
    }

    public boolean plateTaken(String plate, Long exceptId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM vehicles WHERE lower(btrim(plate)) = lower(btrim(?))
                               AND (CAST(? AS BIGINT) IS NULL OR id <> ?))
                """, Boolean.class, plate, exceptId, exceptId));
    }

    public long create(String plate, String name, int capacity) {
        return jdbc.queryForObject("INSERT INTO vehicles(plate, name, capacity_units) VALUES (?, ?, ?) RETURNING id",
                Long.class, plate, name, capacity);
    }

    public void update(long id, String plate, String name, int capacity, boolean active) {
        jdbc.update("UPDATE vehicles SET plate = ?, name = ?, capacity_units = ?, active = ? WHERE id = ?",
                plate, name, capacity, active, id);
    }

    /** Chuyến khác (không tính {@code exceptTripId}) đang giữ xe này. */
    public Optional<BusyTrip> vehicleBusy(long vehicleId, Long exceptTripId) {
        return busy("t.vehicle_id = ?", vehicleId, exceptTripId);
    }

    /** Chuyến khác (không tính {@code exceptTripId}) đang giữ tài xế này. */
    public Optional<BusyTrip> driverBusy(long driverId, Long exceptTripId) {
        return busy("t.driver_id = ?", driverId, exceptTripId);
    }

    private Optional<BusyTrip> busy(String owner, long ownerId, Long exceptTripId) {
        return jdbc.query("SELECT t.id, t.status FROM delivery_trips t WHERE " + owner
                        + " AND (CAST(? AS BIGINT) IS NULL OR t.id <> ?) AND " + HOLDING_TRIP + " ORDER BY t.id LIMIT 1",
                (rs, i) -> new BusyTrip(rs.getLong("id"), rs.getString("status")), ownerId, exceptTripId, exceptTripId)
                .stream().findFirst();
    }

    /** Chuyến đang giữ từng xe, để danh sách xe hiện xe nào đang bận. */
    public java.util.Map<Long, Long> busyTripByVehicle() {
        var result = new java.util.HashMap<Long, Long>();
        jdbc.query("SELECT t.vehicle_id, MIN(t.id) AS trip_id FROM delivery_trips t WHERE t.vehicle_id IS NOT NULL AND "
                + HOLDING_TRIP + " GROUP BY t.vehicle_id", rs -> {
            result.put(rs.getLong("vehicle_id"), rs.getLong("trip_id"));
        });
        return result;
    }

    /** Chuyến đang giữ từng tài xế. */
    public java.util.Map<Long, Long> busyTripByDriver() {
        var result = new java.util.HashMap<Long, Long>();
        jdbc.query("SELECT t.driver_id, MIN(t.id) AS trip_id FROM delivery_trips t WHERE t.driver_id IS NOT NULL AND "
                + HOLDING_TRIP + " GROUP BY t.driver_id", rs -> {
            result.put(rs.getLong("driver_id"), rs.getLong("trip_id"));
        });
        return result;
    }

    /** Số kiện hàng của các đơn đang trên chuyến. */
    public int tripUnits(long tripId) {
        Integer units = jdbc.queryForObject("""
                SELECT COALESCE(SUM(oi.quantity), 0) FROM delivery_assignments a
                JOIN order_items oi ON oi.order_id = a.order_id WHERE a.trip_id = ? AND a.active
                """, Integer.class, tripId);
        return units == null ? 0 : units;
    }

    /** Số kiện hàng và mã của một đơn. */
    public record OrderLoad(String orderCode, int units) {}

    public OrderLoad orderLoad(long orderId) {
        return jdbc.queryForObject("""
                SELECT o.order_code, COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id), 0) AS units
                FROM orders o WHERE o.id = ?
                """, (rs, i) -> new OrderLoad(rs.getString("order_code"), rs.getInt("units")), orderId);
    }

    /** Giữ khóa tài xế để hai yêu cầu xếp chuyến cùng lúc không cùng giao cho một người. */
    public void lockDriver(long driverId) {
        jdbc.query("SELECT id FROM users WHERE id = ? FOR UPDATE", rs -> {}, driverId);
    }
}
