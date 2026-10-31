package com.aquaflow.inventory.api;

import com.aquaflow.customer.order.repository.OrderItemRepository;
import com.aquaflow.customer.order.repository.OrderRepository;
import com.aquaflow.customer.repository.CustomerAddressRepository;
import com.aquaflow.customer.application.CustomerAuditService;
import com.aquaflow.customer.repository.CustomerRepository;
import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.inventory.api.dto.CreateProductRequest;
import com.aquaflow.inventory.api.dto.ProductResponse;
import com.aquaflow.inventory.application.BottleTypeService;
import com.aquaflow.inventory.application.ProductService;
import com.aquaflow.inventory.application.SupplierService;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.jwt.secret=test-test-test-test-test-test-test-test",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.flywaydb.autoconfigure.FlywayAutoConfiguration"
})
@AutoConfigureMockMvc
class ProductControllerIntegrationTest {
    @MockitoBean private com.aquaflow.workspace.repository.StoreSettingsRepository storeSettingsRepository;
    @MockitoBean private com.aquaflow.workspace.repository.NotificationRepository notificationRepository;



    @MockitoBean
    private com.aquaflow.inventory.application.PurchaseReceiptService purchaseReceiptService;

    @MockitoBean
    private com.aquaflow.inventory.application.StockService stockService;

    @MockitoBean
    private com.aquaflow.inventory.application.StockReservationService stockReservationService;

    private static final String VALID_BODY = """
            {"sku":"NUOC-19L","name":"Nước 19L","brand":"Aqua","unit":"Bình","bottleTypeId":1,"salePrice":20000}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProductService productService;

    @MockitoBean
    private SupplierService supplierService;

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

    @MockitoBean
    private OrderService orderService;

    @Test
    void anonymousUserCanListProducts() throws Exception {
        when(productService.findAll(true)).thenReturn(List.of(sampleProduct()));

        mockMvc.perform(get("/api/v1/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sku").value("NUOC-19L"))
                .andExpect(jsonPath("$[0].image").value("/images/test.png"))
                .andExpect(jsonPath("$[0].bottleTypeName").value("Bình 19L"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminWithoutActiveFilterListsEveryProduct() throws Exception {
        when(productService.findAll(null)).thenReturn(List.of(sampleProduct()));

        mockMvc.perform(get("/api/v1/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sku").value("NUOC-19L"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminWithoutActiveFilterListsEveryBottleType() throws Exception {
        when(bottleTypeService.findAll(null)).thenReturn(List.of(new com.aquaflow.inventory.api.dto.BottleTypeResponse(1L, "Bình 19L", BigDecimal.valueOf(50000), false)));

        mockMvc.perform(get("/api/v1/bottle-types"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].active").value(false));
    }

    @Test
    void anonymousUserCannotListInactiveProducts() throws Exception {
        when(productService.findAll(true)).thenReturn(List.of(sampleProduct()));

        mockMvc.perform(get("/api/v1/products?active=false"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].active").value(true));
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void salesStaffCanReadOnlyActiveProducts() throws Exception {
        when(productService.findAll(true)).thenReturn(List.of(sampleProduct()));

        mockMvc.perform(get("/api/v1/products?active=false"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].active").value(true));

        verify(productService).findAll(true);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanRequestInactiveProducts() throws Exception {
        ProductResponse inactive = new ProductResponse(2L, "OLD-SKU", "Old water", null, "Bottle",
                null, null, null, BigDecimal.TEN, false, Instant.now(), null);
        when(productService.findAll(false)).thenReturn(List.of(inactive));

        mockMvc.perform(get("/api/v1/products?active=false"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].active").value(false));

        verify(productService).findAll(false);
    }

    @Test
    void anonymousUserCannotReadInactiveProductById() throws Exception {
        ProductResponse inactive = new ProductResponse(2L, "OLD-SKU", "Old water", null, "Bottle",
                null, null, null, BigDecimal.TEN, false, Instant.now(), null);
        when(productService.findById(2L)).thenReturn(inactive);

        mockMvc.perform(get("/api/v1/products/2"))
                .andExpect(status().isNotFound());
    }

    @Test
    void missingProductReturns404() throws Exception {
        when(productService.findById(99L)).thenThrow(new NotFoundException("Product not found: 99"));

        mockMvc.perform(get("/api/v1/products/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Product not found: 99"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanCreateProduct() throws Exception {
        when(productService.create(any(CreateProductRequest.class))).thenReturn(sampleProduct());

        mockMvc.perform(post("/api/v1/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanSendImageAndReadItInResponse() throws Exception {
        when(productService.create(any(CreateProductRequest.class))).thenReturn(sampleProduct());
        mockMvc.perform(post("/api/v1/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY.replace("\"salePrice\":20000", "\"salePrice\":20000,\"image\":\"/images/test.png\"")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.image").value("/images/test.png"));
        verify(productService).create(argThat(request -> "/images/test.png".equals(request.image())));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void invalidProductReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sku\":\"\",\"name\":\"Nước 19L\",\"unit\":\"Bình\",\"salePrice\":-1}"))
                .andExpect(status().isBadRequest());
        verify(productService, never()).create(any());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void duplicateSkuReturns409() throws Exception {
        when(productService.create(any(CreateProductRequest.class)))
                .thenThrow(new ConflictException("SKU already exists: NUOC-19L"));

        mockMvc.perform(post("/api/v1/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isConflict());
    }

    @Test
    @WithMockUser(roles = "CUSTOMER")
    void customerCannotCreateProduct() throws Exception {
        mockMvc.perform(post("/api/v1/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isForbidden());
        verify(productService, never()).create(any());
    }

    @Test
    void anonymousUserCannotCreateProduct() throws Exception {
        mockMvc.perform(post("/api/v1/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void guestCannotReadProtectedOrderList() throws Exception {
        mockMvc.perform(get("/api/v1/sales/orders"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void salesStaffCanReadOrderList() throws Exception {
        when(orderService.findAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/sales/orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    private ProductResponse sampleProduct() {
        return new ProductResponse(1L, "NUOC-19L", "Nước 19L", "Aqua", "Bình", null,
                1L, "Bình 19L", new BigDecimal("20000"), true, Instant.now(), "/images/test.png");
    }
}
