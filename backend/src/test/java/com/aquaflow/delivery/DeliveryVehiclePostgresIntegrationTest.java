package com.aquaflow.delivery;

import com.aquaflow.delivery.api.DeliveryDtos.*;
import com.aquaflow.delivery.application.DeliveryService;
import com.aquaflow.delivery.application.VehicleService;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
@AutoConfigureMockMvc
@Transactional
class DeliveryVehiclePostgresIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired DeliveryService trips;
    @Autowired VehicleService vehicles;
    @Autowired MockMvc mvc;
    long ownerId, driverId, productId;
    String tag;

    @BeforeEach void prepare() {
        tag = UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("INSERT INTO roles(code, name) VALUES ('ADMIN','Owner') ON CONFLICT (code) DO NOTHING");
        jdbc.update("INSERT INTO roles(code, name) VALUES ('DELIVERY_STAFF','Driver') ON CONFLICT (code) DO NOTHING");
        ownerId = user("ADMIN", "Chủ", tag + "-owner@vehicle.test");
        driverId = user("DELIVERY_STAFF", "Tài xế An", tag + "-driver@vehicle.test");
        productId = jdbc.queryForObject("INSERT INTO products(sku, name, unit, sale_price) VALUES (?, 'Nước 19L', 'binh', 15000) RETURNING id",
                Long.class, "VEH-" + tag);
    }

    long user(String role, String name, String email) {
        return jdbc.queryForObject("""
                INSERT INTO users(role_id, full_name, email, password_hash)
                VALUES ((SELECT id FROM roles WHERE code = ?), ?, ?, 'unused') RETURNING id
                """, Long.class, role, name, email);
    }

    /** Đơn giao đang chuẩn bị, {@code units} kiện. */
    long order(int units) {
        long id = jdbc.queryForObject("""
                INSERT INTO orders(order_code, channel, fulfillment_type, status, created_by, recipient_name, delivery_address)
                VALUES (?, 'PHONE', 'DELIVERY', 'PREPARING', ?, 'Khách', '1 Test') RETURNING id
                """, Long.class, "VEH-" + tag + "-" + UUID.randomUUID().toString().substring(0, 6), ownerId);
        jdbc.update("INSERT INTO order_items(order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, 15000, ?)",
                id, productId, units, 15000L * units);
        return id;
    }

    VehicleResponse vehicle(String plate, int capacity) {
        return vehicles.create(new VehicleRequest(plate + "-" + tag, "Xe ba gác", capacity, null));
    }

    @Test void driverOnAnUnfinishedTripCannotTakeAnotherOne() {
        long first = trips.create(new CreateTripRequest(driverId, null), ownerId, true).id();
        assertThat(trips.drivers(true)).filteredOn(d -> d.id() == driverId).singleElement()
                .extracting(DriverResponse::busyTripId).isEqualTo(first);
        assertThatThrownBy(() -> trips.create(new CreateTripRequest(driverId, null), ownerId, true))
                .isInstanceOf(ConflictException.class).hasMessageContaining("Tài xế An đang ở chuyến #" + first);
        long second = trips.create(new CreateTripRequest(null, null), ownerId, true).id();
        assertThatThrownBy(() -> trips.assignDriver(second, new AssignDriverRequest(driverId), ownerId, true))
                .isInstanceOf(ConflictException.class).hasMessageContaining("chờ xuất phát");
        // Hủy chuyến đầu thì tài xế rảnh lại.
        trips.cancel(first, ownerId, true);
        assertThat(trips.assignDriver(second, new AssignDriverRequest(driverId), ownerId, true).driverId()).isEqualTo(driverId);
    }

    @Test void tripOnACatalogVehicleKeepsWithinItsCapacity() {
        var truck = vehicle("59A", 5);
        var trip = trips.create(new CreateTripRequest(null, "bỏ qua", truck.id()), ownerId, true);
        assertThat(trip.vehicle()).isEqualTo(truck.plate());
        assertThat(trip.vehicleCapacity()).isEqualTo(5);
        long small = order(3), big = order(3);
        assertThat(trips.addOrder(trip.id(), new AddOrderRequest(small), ownerId, true).loadUnits()).isEqualTo(3);
        assertThatThrownBy(() -> trips.addOrder(trip.id(), new AddOrderRequest(big), ownerId, true))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("chở tối đa 5 kiện").hasMessageContaining("vượt 1 kiện");
        assertThat(trips.get(trip.id(), ownerId, true).orders()).hasSize(1);
        // Đơn vừa đủ chỗ thì vẫn thêm được.
        assertThat(trips.addOrder(trip.id(), new AddOrderRequest(order(2)), ownerId, true).loadUnits()).isEqualTo(5);
    }

    @Test void busyVehicleCannotStartAnotherTripOrBeRetired() {
        var truck = vehicle("51C", 40);
        long trip = trips.create(new CreateTripRequest(null, null, truck.id()), ownerId, true).id();
        assertThat(vehicles.list()).filteredOn(v -> v.id().equals(truck.id())).singleElement()
                .extracting(VehicleResponse::busyTripId).isEqualTo(trip);
        assertThatThrownBy(() -> trips.create(new CreateTripRequest(null, null, truck.id()), ownerId, true))
                .isInstanceOf(ConflictException.class).hasMessageContaining("đang ở chuyến #" + trip);
        assertThatThrownBy(() -> vehicles.update(truck.id(), new VehicleRequest(truck.plate(), null, 40, false)))
                .isInstanceOf(ConflictException.class);
        trips.cancel(trip, ownerId, true);
        var retired = vehicles.update(truck.id(), new VehicleRequest(truck.plate(), null, 40, false));
        assertThat(retired.active()).isFalse();
        assertThatThrownBy(() -> trips.create(new CreateTripRequest(null, null, truck.id()), ownerId, true))
                .isInstanceOf(ConflictException.class).hasMessageContaining("ngừng sử dụng");
    }

    @Test void platesAreUniqueIgnoringCase() {
        var truck = vehicle("29b", 10);
        assertThatThrownBy(() -> vehicles.create(new VehicleRequest(" " + truck.plate().toUpperCase() + " ", null, 10, null)))
                .isInstanceOf(ConflictException.class).hasMessageContaining("đã có");
    }

    @Test @WithMockUser(roles = "SALES_STAFF") void salesStaffSeeVehiclesButCannotEditThem() throws Exception {
        mvc.perform(get("/api/v1/delivery/vehicles")).andExpect(status().isOk());
        mvc.perform(post("/api/v1/delivery/vehicles").contentType("application/json")
                .content("{\"plate\":\"X-" + tag + "\",\"capacity\":10}")).andExpect(status().isForbidden());
    }

    @Test @WithMockUser(roles = "ADMIN") void ownerAddsAVehicleAndBadCapacityIsRejected() throws Exception {
        mvc.perform(post("/api/v1/delivery/vehicles").contentType("application/json")
                .content("{\"plate\":\"Y-" + tag + "\",\"name\":\"Xe tải nhỏ\",\"capacity\":60}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.capacity").value(60))
                .andExpect(jsonPath("$.active").value(true));
        mvc.perform(post("/api/v1/delivery/vehicles").contentType("application/json")
                .content("{\"plate\":\"Z-" + tag + "\",\"capacity\":0}")).andExpect(status().isBadRequest());
    }
}
