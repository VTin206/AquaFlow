package com.aquaflow.inventory.api;

import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.inventory.api.dto.CreateProductRequest;
import com.aquaflow.inventory.api.dto.ProductResponse;
import com.aquaflow.inventory.application.BottleTypeService;
import com.aquaflow.inventory.application.ProductService;
import com.aquaflow.inventory.application.SupplierService;
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

    @Test
    void anonymousUserCanListProducts() throws Exception {
        when(productService.findAll(null)).thenReturn(List.of(sampleProduct()));

        mockMvc.perform(get("/api/v1/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sku").value("NUOC-19L"))
                .andExpect(jsonPath("$[0].bottleTypeName").value("Bình 19L"));
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

    private ProductResponse sampleProduct() {
        return new ProductResponse(1L, "NUOC-19L", "Nước 19L", "Aqua", "Bình", null,
                1L, "Bình 19L", new BigDecimal("20000"), true, Instant.now());
    }
}
