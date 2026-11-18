package com.aquaflow.customer.api;

import com.aquaflow.auth.application.JwtService;
import com.aquaflow.customer.api.dto.CustomerRequest;
import com.aquaflow.customer.api.dto.CustomerResponse;
import com.aquaflow.customer.application.CustomerService;
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

import com.aquaflow.customer.api.dto.CustomerPageResponse;
import com.aquaflow.customer.api.dto.CustomerSummary;
import com.aquaflow.customer.repository.CustomerQueryRepository;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.shared.api.PageRequestParams;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        value = CustomerController.class,
        properties = "app.jwt.secret=test-test-test-test-test-test-test-test"
)
@Import(SecurityConfig.class)
class CustomerControllerTest {

    private static final String CUSTOMER_URL =
            "/api/v1/sales/customers";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CustomerService customerService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private OrderService orderService;

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void searchPassesQueryIdleAndPageAndReturnsTotals() throws Exception {
        CustomerSummary summary = new CustomerSummary(7L, "Nguyễn Văn Đức", "0901234567", null, "Cá nhân", null, null,
                3, null, "99 Lê Lợi", new BigDecimal("50000"), 2, new BigDecimal("100000"));
        when(customerService.search("duc", "14", new CustomerQueryRepository.Sort(CustomerQueryRepository.SortField.ORDERS, true), new PageRequestParams(2, 10)))
                .thenReturn(new CustomerPageResponse(List.of(summary), 2, 10, 21, 3,
                        new CustomerPageResponse.Totals(21, new BigDecimal("50000"), 2, new BigDecimal("100000"))));

        mockMvc.perform(get(CUSTOMER_URL).param("q", "duc").param("idle", "14").param("sort", "ORDERS").param("direction", "DESC").param("page", "2").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(7))
                .andExpect(jsonPath("$.items[0].orderCount").value(3))
                .andExpect(jsonPath("$.items[0].lastDeliveryAddress").value("99 Lê Lợi"))
                .andExpect(jsonPath("$.total").value(21))
                .andExpect(jsonPath("$.totals.due").value(50000));
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void customerOrdersReturn404ForUnknownCustomer() throws Exception {
        when(customerService.findSummary(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get(CUSTOMER_URL + "/99/orders")).andExpect(status().isNotFound());
        mockMvc.perform(get(CUSTOMER_URL + "/99")).andExpect(status().isNotFound());
        verify(orderService, never()).customerOrders(99L);
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void customerOrdersListHistory() throws Exception {
        when(customerService.findSummary(7L)).thenReturn(Optional.of(new CustomerSummary(7L, "An", null, null, null, null, null,
                0, null, null, BigDecimal.ZERO, 0, BigDecimal.ZERO)));
        when(orderService.customerOrders(7L)).thenReturn(List.of());

        mockMvc.perform(get(CUSTOMER_URL + "/7/orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @WithMockUser(roles = "CUSTOMER")
    void customerRoleCannotListCustomers() throws Exception {
        mockMvc.perform(get(CUSTOMER_URL)).andExpect(status().isForbidden());
    }

    @Test
    void unauthenticatedRequestReturns401() throws Exception {
        mockMvc.perform(post(CUSTOMER_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "fullName": "Nguyen Van An",
                                    "phone": "0901234567"
                                }
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "CUSTOMER")
    void customerRoleCannotCreateCustomer() throws Exception {
        mockMvc.perform(post(CUSTOMER_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "fullName": "Nguyen Van An",
                                    "phone": "0901234567"
                                }
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void invalidPhoneReturns400() throws Exception {
        mockMvc.perform(post(CUSTOMER_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "fullName": "Nguyen Van An",
                                    "phone": "090 123 4567"
                                }
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void validRequestCreatesCustomerAndReturns201() throws Exception {
        CustomerResponse response = new CustomerResponse(
                101L,
                "Nguyen Van An",
                "0901234567",
                Instant.parse("2026-10-21T08:00:00Z"));

        when(customerService.create(any(CustomerRequest.class)))
                .thenReturn(response);

        mockMvc.perform(post(CUSTOMER_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "fullName": "Nguyen Van An",
                                    "phone": "0901234567"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(101))
                .andExpect(jsonPath("$.fullName")
                        .value("Nguyen Van An"))
                .andExpect(jsonPath("$.phone")
                        .value("0901234567"));
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void missingPhoneIsAllowedWhenCreatingCustomer() throws Exception {
        CustomerResponse response = new CustomerResponse(
                102L,
                "Nguyen Van An",
                null,
                Instant.parse("2026-10-21T08:00:00Z"));

        when(customerService.create(any(CustomerRequest.class)))
                .thenReturn(response);

        mockMvc.perform(post(CUSTOMER_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "fullName": "Nguyen Van An"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(102))
                .andExpect(jsonPath("$.fullName")
                        .value("Nguyen Van An"));
    }
}
