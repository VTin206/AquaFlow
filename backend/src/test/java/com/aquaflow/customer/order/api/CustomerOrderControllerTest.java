package com.aquaflow.customer.order.api;

import com.aquaflow.auth.application.JwtService;
import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.customer.api.dto.CustomerResponse;
import com.aquaflow.customer.application.CustomerService;
import com.aquaflow.customer.order.api.dto.OrderCreateRequest;
import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.api.dto.GuestOrderCreateRequest;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        value = CustomerOrderController.class,
        properties = "app.jwt.secret=test-test-test-test-test-test-test-test"
)
@Import(SecurityConfig.class)
class CustomerOrderControllerTest {

    private static final String ORDERS_URL = "/api/v1/customer/orders";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrderService orderService;

    @MockBean
    private CustomerService customerService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @Test
    void createOrderReturns201ForAuthenticatedCustomer() throws Exception {
        when(customerService.findOrCreateForUser(
                7L, "Nguyen Van An", "0901234567"))
                .thenReturn(sampleCustomer());

        when(orderService.createForCustomer(
                any(OrderCreateRequest.class), eq(5L), eq(7L)))
                .thenReturn(sampleOrder());

        String requestBody = """
                {
                    "customerId": 999,
                    "channel": "WEB",
                    "fulfillmentType": "DELIVERY",
                    "recipientName": "Nguyen Van An",
                    "recipientPhone": "0901234567",
                    "deliveryAddress": "123 Nguyen Trai",
                    "deliveryArea": "Quan 5",
                    "items": [
                        {
                            "productId": 101,
                            "quantity": 2
                        }
                    ],
                    "note": "Online order test"
                }
                """;

        mockMvc.perform(post(ORDERS_URL)
                        .with(authentication(customerAuthentication()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.customerId").value(5))
                .andExpect(jsonPath("$.channel").value("WEB"));

        verify(orderService).createForCustomer(
                any(OrderCreateRequest.class), eq(5L), eq(7L));
    }

    @Test
    void anonymousUserCanCreateGuestOrder() throws Exception {
        when(orderService.createForGuest(any(GuestOrderCreateRequest.class)))
                .thenReturn(sampleGuestOrder());

        mockMvc.perform(post(ORDERS_URL + "/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "recipientName": "Nguyen Van An",
                                    "recipientPhone": "0901234567",
                                    "deliveryAddress": "123 Nguyen Trai",
                                    "deliveryArea": "Quan 5",
                                    "items": [
                                        {
                                            "productId": 101,
                                            "quantity": 2
                                        }
                                    ],
                                    "note": "Guest order"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.customerId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.channel").value("WEB"));

        verify(orderService).createForGuest(any(GuestOrderCreateRequest.class));
    }

    @Test
    void guestOrderValidationRejectsInvalidQuantity() throws Exception {
        mockMvc.perform(post(ORDERS_URL + "/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "recipientName": "Nguyen Van An",
                                    "recipientPhone": "0901234567",
                                    "deliveryAddress": "123 Nguyen Trai",
                                    "items": [
                                        {
                                            "productId": 101,
                                            "quantity": 0
                                        }
                                    ]
                                }
                                """))
                .andExpect(status().isBadRequest());

        org.mockito.Mockito.verifyNoInteractions(orderService);
    }

    @Test
    void customerCanListOwnOrders() throws Exception {
        when(customerService.findActiveByUserId(7L))
                .thenReturn(Optional.of(sampleCustomer()));

        when(orderService.findAllByCustomerId(5L))
                .thenReturn(List.of(sampleOrder()));

        mockMvc.perform(get(ORDERS_URL)
                        .with(authentication(customerAuthentication()))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].customerId").value(5))
                .andExpect(jsonPath("$[0].orderCode").value("AF-ONLINE-1"));

        verify(orderService).findAllByCustomerId(5L);
    }

    @Test
    void customerCannotViewOrderThatDoesNotBelongToThem() throws Exception {
        when(customerService.findActiveByUserId(7L))
                .thenReturn(Optional.of(sampleCustomer()));

        when(orderService.findByIdAndCustomerId(999L, 5L))
                .thenReturn(Optional.empty());

        mockMvc.perform(get(ORDERS_URL + "/999")
                        .with(authentication(customerAuthentication())))
                .andExpect(status().isNotFound());

        verify(orderService).findByIdAndCustomerId(999L, 5L);
    }

    @Test
    void anonymousUserCannotCreateOnlineOrder() throws Exception {
        mockMvc.perform(post(ORDERS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void anonymousUserCannotListCustomerOrders() throws Exception {
        mockMvc.perform(get(ORDERS_URL))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void salesStaffCannotAccessCustomerOrderApi() throws Exception {
        mockMvc.perform(get(ORDERS_URL))
                .andExpect(status().isForbidden());
    }

    private Authentication customerAuthentication() {
        User user = mock(User.class);
        AuthUserDetails principal = mock(AuthUserDetails.class);

        when(principal.user()).thenReturn(user);
        when(user.getId()).thenReturn(7L);
        when(user.getFullName()).thenReturn("Nguyen Van An");
        when(user.getPhone()).thenReturn("0901234567");

        return new UsernamePasswordAuthenticationToken(
                principal,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER")));
    }

    private CustomerResponse sampleCustomer() {
        return new CustomerResponse(
                5L,
                "Nguyen Van An",
                "0901234567",
                Instant.parse("2026-10-25T12:00:00Z"));
    }

    private OrderResponse sampleOrder() {
        return new OrderResponse(
                1L,
                "AF-ONLINE-1",
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
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                new BigDecimal("250.00"),
                OffsetDateTime.parse("2026-10-25T09:00:00+07:00"),
                null,
                null,
                "Online order test",
                List.of());
    }

    private OrderResponse sampleGuestOrder() {
        return new OrderResponse(
                2L,
                "AF-GUEST-1",
                null,
                null,
                OrderChannel.WEB,
                FulfillmentType.DELIVERY,
                OrderStatus.PENDING,
                PaymentStatus.UNPAID,
                "Nguyen Van An",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5",
                null,
                new BigDecimal("250.00"),
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                new BigDecimal("250.00"),
                OffsetDateTime.parse("2026-10-25T09:00:00+07:00"),
                null,
                null,
                "Guest order",
                List.of());
    }
}
