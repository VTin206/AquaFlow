package com.aquaflow.customer.order.api;

import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.customer.order.api.dto.OrderCreateRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import com.aquaflow.auth.application.JwtService;
import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.InvalidOrderStatusTransitionException;
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

    @Test
    void createOrderReturns201WhenSalesStaffIsAuthenticated() throws Exception {
        AuthUserDetails principal = mock(AuthUserDetails.class);
        User user = mock(User.class);

        when(principal.user()).thenReturn(user);
        when(user.getId()).thenReturn(7L);

        Authentication auth = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_SALES_STAFF")));

        when(orderService.createForStaff(any(OrderCreateRequest.class), eq(7L)))
                .thenReturn(sampleOrder());

        String requestBody = """
                {
                    "customerId": 5,
                    "channel": "COUNTER",
                    "fulfillmentType": "COUNTER",
                    "recipientName": "Nguyen Van An",
                    "recipientPhone": "0901234567",
                    "items": [
                        {
                            "productId": 101,
                            "quantity": 2
                        }
                    ],
                    "note": "Test create order"
                }
                """;

        mockMvc.perform(post(ORDERS_URL)
                        .with(authentication(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.orderCode").value("AF-1001"));

        org.mockito.Mockito.verify(orderService)
                .createForStaff(any(OrderCreateRequest.class), eq(7L));
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void updateStatusReturns200WhenOrderExists() throws Exception {
        when(orderService.transitionStatus(1L, OrderStatus.CONFIRMED))
                .thenReturn(Optional.of(sampleOrder()));

        mockMvc.perform(patch(ORDERS_URL + "/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "status": "CONFIRMED"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));

        verify(orderService).transitionStatus(1L, OrderStatus.CONFIRMED);
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void updateStatusReturns409WhenTransitionIsInvalid() throws Exception {
        String message = "Invalid order status transition from COMPLETED to PENDING";
        when(orderService.transitionStatus(1L, OrderStatus.PENDING))
                .thenThrow(new InvalidOrderStatusTransitionException(message));

        mockMvc.perform(patch(ORDERS_URL + "/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "status": "PENDING"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value(message));
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void updateStatusReturns404WhenOrderDoesNotExist() throws Exception {
        when(orderService.transitionStatus(999L, OrderStatus.CANCELLED))
                .thenReturn(Optional.empty());

        mockMvc.perform(patch(ORDERS_URL + "/999/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "status": "CANCELLED"
                                }
                                """))
                .andExpect(status().isNotFound());

        verify(orderService).transitionStatus(999L, OrderStatus.CANCELLED);
    }
}
