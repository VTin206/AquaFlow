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

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
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
