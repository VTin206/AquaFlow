package com.aquaflow.customer.order.api;

import com.aquaflow.auth.application.JwtService;
import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderChannel;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.domain.PaymentStatus;
import com.aquaflow.shared.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        value = OrderController.class,
        properties = "app.jwt.secret=test-test-test-test-test-test-test-test"
)
@Import(SecurityConfig.class)
class OrderControllerTest {

    private static final String ORDERS_URL = "/api/v1/sales/orders";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrderService orderService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void findAllReturnsOrders() throws Exception {
        when(orderService.findAll())
                .thenReturn(List.of(sampleOrder()));

        mockMvc.perform(get(ORDERS_URL)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].orderCode").value("AF-1001"))
                .andExpect(jsonPath("$[0].status").value("PENDING"))
                .andExpect(jsonPath("$[0].total").value(240.00));
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void findByIdReturnsOrderWhenFound() throws Exception {
        when(orderService.findById(1L))
                .thenReturn(Optional.of(sampleOrder()));

        mockMvc.perform(get(ORDERS_URL + "/1")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.orderCode").value("AF-1001"))
                .andExpect(jsonPath("$.paymentStatus").value("UNPAID"));
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void findByIdReturns404WhenOrderDoesNotExist() throws Exception {
        when(orderService.findById(999L))
                .thenReturn(Optional.empty());

        mockMvc.perform(get(ORDERS_URL + "/999"))
                .andExpect(status().isNotFound());
    }

    @Test
    void unauthenticatedRequestReturns401() throws Exception {
        mockMvc.perform(get(ORDERS_URL))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "CUSTOMER")
    void customerRoleCannotAccessSalesOrders() throws Exception {
        mockMvc.perform(get(ORDERS_URL))
                .andExpect(status().isForbidden());
    }

    private OrderResponse sampleOrder() {
        return new OrderResponse(
                1L,
                "AF-1001",
                5L,
                7L,
                OrderChannel.WEB,
                FulfillmentType.DELIVERY,
                OrderStatus.PENDING,
                PaymentStatus.UNPAID,
                "Nguyen Van An",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5",
                OffsetDateTime.parse("2027-01-15T09:00:00+07:00"),
                new BigDecimal("250.00"),
                new BigDecimal("20.00"),
                new BigDecimal("10.00"),
                new BigDecimal("240.00"),
                OffsetDateTime.parse("2026-10-21T09:00:00+07:00"),
                null,
                null,
                "Order controller test",
                List.of()
        );
    }
}
