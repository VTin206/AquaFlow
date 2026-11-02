package com.aquaflow.delivery.api;

import com.aquaflow.auth.application.JwtService;
import com.aquaflow.auth.domain.Role;
import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.delivery.api.dto.DeliveryRedeliveryResponse;
import com.aquaflow.delivery.application.RedeliveryWorkflowService;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        value = DeliveryRedeliveryController.class,
        properties = "app.jwt.secret=test-test-test-test-test-test-test-test"
)
@Import(SecurityConfig.class)
class DeliveryRedeliveryControllerTest {

    private static final String REDELIVERY_URL =
            "/api/v1/delivery/attempts/100/redelivery";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RedeliveryWorkflowService redeliveryWorkflowService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @Test
    void salesStaffCanPrepareRedeliveryAndCreateNewAssignment()
            throws Exception {

        when(redeliveryWorkflowService.prepareRedelivery(
                100L,
                55L,
                7L,
                "SALES_STAFF"))
                .thenReturn(new DeliveryRedeliveryResponse(
                        100L,
                        20L,
                        OrderStatus.PREPARING,
                        55L,
                        99L));

        mockMvc.perform(post(REDELIVERY_URL)
                        .with(authentication(
                                authenticatedAs(7L, "SALES_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "newTripId": 55
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.previousAttemptId").value(100))
                .andExpect(jsonPath("$.orderId").value(20))
                .andExpect(jsonPath("$.orderStatus").value("PREPARING"))
                .andExpect(jsonPath("$.newTripId").value(55))
                .andExpect(jsonPath("$.newAssignmentId").value(99));

        verify(redeliveryWorkflowService).prepareRedelivery(
                100L,
                55L,
                7L,
                "SALES_STAFF");
    }

    @Test
    void adminCanPrepareRedelivery()
            throws Exception {

        when(redeliveryWorkflowService.prepareRedelivery(
                100L,
                55L,
                1L,
                "ADMIN"))
                .thenReturn(new DeliveryRedeliveryResponse(
                        100L,
                        20L,
                        OrderStatus.PREPARING,
                        55L,
                        99L));

        mockMvc.perform(post(REDELIVERY_URL)
                        .with(authentication(
                                authenticatedAs(1L, "ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "newTripId": 55
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.newAssignmentId").value(99));

        verify(redeliveryWorkflowService).prepareRedelivery(
                100L,
                55L,
                1L,
                "ADMIN");
    }

    @Test
    void missingNewTripIdReturns400()
            throws Exception {

        mockMvc.perform(post(REDELIVERY_URL)
                        .with(authentication(
                                authenticatedAs(7L, "SALES_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(redeliveryWorkflowService);
    }

    @Test
    void nonPositiveNewTripIdReturns400()
            throws Exception {

        mockMvc.perform(post(REDELIVERY_URL)
                        .with(authentication(
                                authenticatedAs(7L, "SALES_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "newTripId": 0
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(redeliveryWorkflowService);
    }

    @Test
    void deliveryStaffCannotPrepareRedelivery()
            throws Exception {

        mockMvc.perform(post(REDELIVERY_URL)
                        .with(authentication(
                                authenticatedAs(7L, "DELIVERY_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "newTripId": 55
                                }
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(redeliveryWorkflowService);
    }

    @Test
    void unauthenticatedRequestReturns401()
            throws Exception {

        mockMvc.perform(post(REDELIVERY_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "newTripId": 55
                                }
                                """))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(redeliveryWorkflowService);
    }

    @Test
    void workflowConflictReturns409()
            throws Exception {

        when(redeliveryWorkflowService.prepareRedelivery(
                100L,
                55L,
                7L,
                "SALES_STAFF"))
                .thenThrow(new ConflictException(
                        "Return inspection must be completed before redelivery"));

        mockMvc.perform(post(REDELIVERY_URL)
                        .with(authentication(
                                authenticatedAs(7L, "SALES_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "newTripId": 55
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message")
                        .value("Return inspection must be completed before redelivery"));
    }

    private Authentication authenticatedAs(
            Long userId,
            String roleCode) {

        User user = mock(User.class);

        when(user.getId()).thenReturn(userId);
        when(user.getRole()).thenReturn(
                new Role(roleCode, roleCode));

        AuthUserDetails principal = new AuthUserDetails(user);

        return new UsernamePasswordAuthenticationToken(
                principal,
                null,
                principal.getAuthorities());
    }
}
