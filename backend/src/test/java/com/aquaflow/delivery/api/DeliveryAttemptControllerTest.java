package com.aquaflow.delivery.api;

import com.aquaflow.auth.application.JwtService;
import com.aquaflow.auth.domain.Role;
import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.delivery.api.dto.DeliveryAttemptCreateRequest;
import com.aquaflow.delivery.api.dto.DeliveryAttemptResponse;
import com.aquaflow.delivery.application.DeliveryAttemptWorkflowService;
import com.aquaflow.delivery.domain.DeliveryAttemptOutcome;
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
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.time.OffsetDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        value = DeliveryAttemptController.class,
        properties = "app.jwt.secret=test-test-test-test-test-test-test-test"
)
@Import(SecurityConfig.class)
class DeliveryAttemptControllerTest {

    private static final String ATTEMPT_URL =
            "/api/v1/delivery/assignments/10/attempts";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DeliveryAttemptWorkflowService workflowService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @Test
    void deliveryStaffCanRecordSuccessfulAttempt() throws Exception {
        when(workflowService.recordAttempt(
                eq(10L),
                eq(7L),
                eq("DELIVERY_STAFF"),
                any(DeliveryAttemptCreateRequest.class)))
                .thenReturn(sampleResponse(DeliveryAttemptOutcome.SUCCESS));

        mockMvc.perform(post(ATTEMPT_URL)
                        .with(authentication(
                                authenticatedAs(7L, "DELIVERY_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "outcome": "SUCCESS",
                                    "recipientName": "Nguyen Van An",
                                    "failureReason": null,
                                    "note": "Da giao hang cho nguoi nhan"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(100))
                .andExpect(jsonPath("$.assignmentId").value(10))
                .andExpect(jsonPath("$.attemptNo").value(1))
                .andExpect(jsonPath("$.outcome").value("SUCCESS"))
                .andExpect(jsonPath("$.recipientName")
                        .value("Nguyen Van An"));

        verify(workflowService).recordAttempt(
                eq(10L),
                eq(7L),
                eq("DELIVERY_STAFF"),
                any(DeliveryAttemptCreateRequest.class));
    }

    @Test
    void deliveryStaffCanRecordFailedAttempt() throws Exception {
        when(workflowService.recordAttempt(
                eq(10L),
                eq(7L),
                eq("DELIVERY_STAFF"),
                any(DeliveryAttemptCreateRequest.class)))
                .thenReturn(sampleResponse(DeliveryAttemptOutcome.FAILED));

        mockMvc.perform(post(ATTEMPT_URL)
                        .with(authentication(
                                authenticatedAs(7L, "DELIVERY_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "outcome": "FAILED",
                                    "recipientName": "Nguyen Van An",
                                    "failureReason": "Khong lien he duoc nguoi nhan",
                                    "note": "Da goi dien hai lan"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.outcome").value("FAILED"))
                .andExpect(jsonPath("$.failureReason")
                        .value("Khong lien he duoc nguoi nhan"));

        verify(workflowService).recordAttempt(
                eq(10L),
                eq(7L),
                eq("DELIVERY_STAFF"),
                any(DeliveryAttemptCreateRequest.class));
    }

    @Test
    void failedAttemptWithoutFailureReasonReturns400()
            throws Exception {

        mockMvc.perform(post(ATTEMPT_URL)
                        .with(authentication(
                                authenticatedAs(7L, "DELIVERY_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "outcome": "FAILED",
                                    "recipientName": "Nguyen Van An",
                                    "failureReason": null,
                                    "note": "Da thu giao hang"
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(workflowService);
    }

    @Test
    void successfulAttemptWithFailureReasonReturns400()
            throws Exception {

        mockMvc.perform(post(ATTEMPT_URL)
                        .with(authentication(
                                authenticatedAs(7L, "DELIVERY_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "outcome": "SUCCESS",
                                    "recipientName": "Nguyen Van An",
                                    "failureReason": "Khong lien he duoc",
                                    "note": "Test invalid request"
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(workflowService);
    }

    @Test
    void invalidOutcomeReturns400() throws Exception {
        mockMvc.perform(post(ATTEMPT_URL)
                        .with(authentication(
                                authenticatedAs(7L, "DELIVERY_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "outcome": "UNKNOWN",
                                    "recipientName": "Nguyen Van An",
                                    "failureReason": null,
                                    "note": "Test invalid outcome"
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(workflowService);
    }

    @Test
    @WithMockUser(roles = "SALES_STAFF")
    void salesStaffCannotRecordDeliveryAttempt() throws Exception {
        mockMvc.perform(post(ATTEMPT_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "outcome": "SUCCESS",
                                    "recipientName": "Nguyen Van An",
                                    "failureReason": null,
                                    "note": "Test"
                                }
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(workflowService);
    }

    @Test
    void unauthenticatedRequestReturns401() throws Exception {
        mockMvc.perform(post(ATTEMPT_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "outcome": "SUCCESS",
                                    "recipientName": "Nguyen Van An",
                                    "failureReason": null,
                                    "note": "Test"
                                }
                                """))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(workflowService);
    }

    @Test
    void workflowConflictReturns409() throws Exception {
        when(workflowService.recordAttempt(
                eq(10L),
                eq(7L),
                eq("DELIVERY_STAFF"),
                any(DeliveryAttemptCreateRequest.class)))
                .thenThrow(new ConflictException(
                        "Order must be OUT_FOR_DELIVERY"));

        mockMvc.perform(post(ATTEMPT_URL)
                        .with(authentication(
                                authenticatedAs(7L, "DELIVERY_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "outcome": "SUCCESS",
                                    "recipientName": "Nguyen Van An",
                                    "failureReason": null,
                                    "note": "Test"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message")
                        .value("Order must be OUT_FOR_DELIVERY"));
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

    private DeliveryAttemptResponse sampleResponse(
            DeliveryAttemptOutcome outcome) {

        return new DeliveryAttemptResponse(
                100L,
                10L,
                1,
                outcome,
                "Nguyen Van An",
                OffsetDateTime.parse("2026-11-02T18:00:00+07:00"),
                outcome == DeliveryAttemptOutcome.FAILED
                        ? "Khong lien he duoc nguoi nhan"
                        : null,
                "Delivery attempt controller test");
    }

    @Test
    void deliveryStaffCanReadOrderAttemptHistoryAcrossRedeliveryAssignments()
            throws Exception {

        when(workflowService.findOrderAttempts(
                20L, 7L, "DELIVERY_STAFF"))
                .thenReturn(java.util.List.of(
                        sampleResponse(DeliveryAttemptOutcome.FAILED),
                        new DeliveryAttemptResponse(
                                101L,
                                11L,
                                2,
                                DeliveryAttemptOutcome.SUCCESS,
                                "Nguyen Van An",
                                OffsetDateTime.parse(
                                        "2026-11-02T19:00:00+07:00"),
                                null,
                                "Redelivery succeeded")));

        mockMvc.perform(get("/api/v1/delivery/orders/20/attempts")
                        .with(authentication(
                                authenticatedAs(7L, "DELIVERY_STAFF"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].assignmentId").value(10))
                .andExpect(jsonPath("$[0].outcome").value("FAILED"))
                .andExpect(jsonPath("$[1].assignmentId").value(11))
                .andExpect(jsonPath("$[1].attemptNo").value(2))
                .andExpect(jsonPath("$[1].outcome").value("SUCCESS"));

        verify(workflowService)
                .findOrderAttempts(20L, 7L, "DELIVERY_STAFF");
    }

    @Test
    @WithMockUser(roles = "CUSTOMER")
    void customerCannotReadInternalDeliveryAttemptHistory()
            throws Exception {

        mockMvc.perform(get("/api/v1/delivery/orders/20/attempts"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(workflowService);
    }
}
