package com.aquaflow.inventory.api;

import com.aquaflow.customer.order.repository.OrderItemRepository;
import com.aquaflow.customer.order.repository.OrderRepository;
import com.aquaflow.customer.repository.CustomerAddressRepository;
import com.aquaflow.customer.application.CustomerAuditService;
import com.aquaflow.customer.repository.CustomerRepository;
import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.inventory.api.dto.SupplierRequest;
import com.aquaflow.inventory.api.dto.SupplierResponse;
import com.aquaflow.inventory.application.BottleTypeService;
import com.aquaflow.inventory.application.ProductService;
import com.aquaflow.inventory.application.SupplierService;
import com.aquaflow.shared.api.NotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.jwt.secret=test-test-test-test-test-test-test-test",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.flywaydb.autoconfigure.FlywayAutoConfiguration"
})
@AutoConfigureMockMvc
class SupplierControllerIntegrationTest {

    @MockitoBean
    private com.aquaflow.inventory.application.PurchaseReceiptService purchaseReceiptService;

    @MockitoBean
    private com.aquaflow.inventory.application.StockService stockService;

    @MockitoBean
    private com.aquaflow.inventory.application.StockReservationService stockReservationService;

    private static final String VALID_BODY = """
            {"name":"Aqua Supplier","phone":"0987654321","address":"123 Main St"}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SupplierService supplierService;

    @MockitoBean
    private ProductService productService;

    @MockitoBean
    private BottleTypeService bottleTypeService;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private CustomerRepository customerRepository;

    @MockitoBean
    private CustomerAddressRepository customerAddressRepository;

    @MockitoBean
    private CustomerAuditService customerAuditService;

    @MockitoBean
    private OrderRepository orderRepository;

    @MockitoBean
    private OrderItemRepository orderItemRepository;

    // ---- Phân quyền xem danh sách ----

    @Test
    void anonymousUserCannotListSuppliers() throws Exception {
        mockMvc.perform(get("/api/v1/suppliers"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void salesStaffCanListSuppliers() throws Exception {
        when(supplierService.findAll(null)).thenReturn(List.of(sampleSupplier()));

        mockMvc.perform(get("/api/v1/suppliers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Aqua Supplier"));
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void activeQueryParameterIsPassedToService() throws Exception {
        when(supplierService.findAll(true)).thenReturn(List.of(sampleSupplier()));

        mockMvc.perform(get("/api/v1/suppliers").param("active", "true"))
                .andExpect(status().isOk());
        verify(supplierService).findAll(true);
    }

    @Test
    @WithMockUser(roles = "DELIVERY_STAFF")
    void deliveryStaffCannotListSuppliers() throws Exception {
        mockMvc.perform(get("/api/v1/suppliers"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "CUSTOMER")
    void customerCannotListSuppliers() throws Exception {
        mockMvc.perform(get("/api/v1/suppliers"))
                .andExpect(status().isForbidden());
    }

    // ---- Phân quyền thêm / sửa / xóa ----

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanCreateSupplier() throws Exception {
        when(supplierService.create(any(SupplierRequest.class))).thenReturn(sampleSupplier());

        mockMvc.perform(post("/api/v1/suppliers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void salesStaffCannotCreateSupplier() throws Exception {
        mockMvc.perform(post("/api/v1/suppliers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isForbidden());
        verify(supplierService, never()).create(any());
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void salesStaffCannotDeleteSupplier() throws Exception {
        mockMvc.perform(delete("/api/v1/suppliers/1"))
                .andExpect(status().isForbidden());
        verify(supplierService, never()).delete(any());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanDeleteSupplier() throws Exception {
        mockMvc.perform(delete("/api/v1/suppliers/1"))
                .andExpect(status().isNoContent());
        verify(supplierService).delete(1L);
    }

    // ---- Validation ----

    @Test
    @WithMockUser(roles = "ADMIN")
    void invalidPhoneReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/suppliers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Aqua Supplier\",\"phone\":\"abc\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("phone")));
        verify(supplierService, never()).create(any());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void blankNameReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/suppliers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void phoneIsOptional() throws Exception {
        when(supplierService.create(any(SupplierRequest.class))).thenReturn(sampleSupplier());

        mockMvc.perform(post("/api/v1/suppliers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Aqua Supplier\"}"))
                .andExpect(status().isCreated());
    }

    // ---- Không tìm thấy ----

    @Test
    @WithMockUser(roles = "ADMIN")
    void updateMissingSupplierReturns404() throws Exception {
        when(supplierService.update(eq(99L), any(SupplierRequest.class)))
                .thenThrow(new NotFoundException("Supplier not found: 99"));

        mockMvc.perform(put("/api/v1/suppliers/99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isNotFound());
    }

    private SupplierResponse sampleSupplier() {
        return new SupplierResponse(1L, "Aqua Supplier", "0987654321", "123 Main St", true);
    }
}
