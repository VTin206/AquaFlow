package com.aquaflow.auth.api;

import com.aquaflow.customer.order.repository.OrderItemRepository;
import com.aquaflow.customer.order.repository.OrderRepository;
import com.aquaflow.customer.repository.CustomerAddressRepository;
import com.aquaflow.customer.application.CustomerAuditService;
import com.aquaflow.customer.repository.CustomerRepository;
import com.aquaflow.auth.domain.Role;
import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.domain.UserStatus;
import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.inventory.repository.BottleTypeRepository;
import com.aquaflow.inventory.repository.ProductRepository;
import com.aquaflow.inventory.repository.SupplierRepository;
import com.aquaflow.auth.application.JwtService;
import com.aquaflow.delivery.application.DeliveryTripService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
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
class AuthControllerIntegrationTest {

    @MockBean
    private com.aquaflow.inventory.application.PurchaseReceiptService purchaseReceiptService;

    @MockBean
    private com.aquaflow.inventory.application.StockService stockService;

    @MockBean
    private com.aquaflow.inventory.application.StockReservationService stockReservationService;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private UserRepository userRepository;

    // Test này tắt JPA nên phải giả lập các repository của module inventory
    @MockBean
    private ProductRepository productRepository;

    @MockBean
    private SupplierRepository supplierRepository;

    @MockBean
    private BottleTypeRepository bottleTypeRepository;

    @MockBean
    private CustomerRepository customerRepository;

    @MockBean
    private CustomerAddressRepository customerAddressRepository;

    @MockBean
    private CustomerAuditService customerAuditService;

    @MockBean
    private OrderRepository orderRepository;

    @MockBean
    private OrderItemRepository orderItemRepository;

    @MockBean
    private DeliveryTripService deliveryTripService;

    private User activeUser;

    @BeforeEach
    void setUp() {
        activeUser = new User(
                new Role("CUSTOMER", "Customer"),
                "Nguyen Van An",
                "an@example.com",
                "0900000000",
                passwordEncoder.encode("correct-password"),
                UserStatus.ACTIVE);
    }

    @Test
    void loginReturnsTokenAndUserProfile() throws Exception {
        when(userRepository.findByEmailIgnoreCase("an@example.com")).thenReturn(Optional.of(activeUser));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"an@example.com\",\"password\":\"correct-password\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.user.email").value("an@example.com"))
                .andExpect(jsonPath("$.user.role").value("CUSTOMER"));
    }

    @Test
    void invalidLoginReturns401() throws Exception {
        when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.of(activeUser));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"an@example.com\",\"password\":\"wrong-password\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Unauthorized"));
    }

    @Test
    void invalidLoginRequestReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"not-an-email\",\"password\":\"short\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void meRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.path").value("/api/v1/auth/me"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanReadDeliveryTripList() throws Exception {
        when(deliveryTripService.findAll()).thenReturn(java.util.List.of());
        mockMvc.perform(get("/api/v1/delivery/trips"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void salesStaffCanReadDeliveryTripList() throws Exception {
        when(deliveryTripService.findAll()).thenReturn(java.util.List.of());
        mockMvc.perform(get("/api/v1/delivery/trips"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "DELIVERY_STAFF")
    void deliveryStaffCannotUseManagementListOrCreateEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/delivery/trips"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/delivery/trips")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"driverId\":1}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "CUSTOMER")
    void customerCannotAccessDeliveryApi() throws Exception {
        mockMvc.perform(get("/api/v1/delivery/trips"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/delivery/driver/trips"))
                .andExpect(status().isForbidden());
    }

    @Test
    void guestCannotAccessDeliveryApi() throws Exception {
        mockMvc.perform(get("/api/v1/delivery/trips"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void customerCannotAccessAdminRoute() throws Exception {
        when(userRepository.findByEmailIgnoreCase("an@example.com")).thenReturn(Optional.of(activeUser));
        String token = jwtService.generateToken(activeUser);

        mockMvc.perform(get("/api/v1/admin/check")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.path").value("/api/v1/admin/check"));
    }

    @Test
    void meReturnsCurrentUserForValidToken() throws Exception {
        when(userRepository.findByEmailIgnoreCase("an@example.com")).thenReturn(Optional.of(activeUser));
        String token = jwtService.generateToken(activeUser);

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("an@example.com"))
                .andExpect(jsonPath("$.role").value("CUSTOMER"));
    }

    @Test
    void tokenForDeletedUserReturns401() throws Exception {
        String token = jwtService.generateToken(activeUser);
        when(userRepository.findByEmailIgnoreCase("an@example.com")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }
}
