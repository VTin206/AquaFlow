package com.aquaflow.delivery.api;

import com.aquaflow.auth.application.JwtService;
import com.aquaflow.auth.domain.Role;
import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.delivery.api.dto.ReturnInspectionCreateRequest;
import com.aquaflow.delivery.api.dto.ReturnInspectionResponse;
import com.aquaflow.delivery.application.ReturnInspectionWorkflowService;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
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

import java.time.OffsetDateTime;
import java.util.List;

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
        value = ReturnInspectionController.class,
        properties = "app.jwt.secret=test-test-test-test-test-test-test-test"
)
@Import(SecurityConfig.class)
class ReturnInspectionControllerTest {

    private static final String RETURN_INSPECTION_URL =
            "/api/v1/delivery/attempts/100/return-inspection";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ReturnInspectionWorkflowService workflowService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @Test
    void salesStaffCanInspectReturnedItems() throws Exception {

        when(workflowService.inspectReturn(
                eq(100L),
                eq(7L),
                eq("SALES_STAFF"),
                any(ReturnInspectionCreateRequest.class)))
                .thenReturn(sampleResponse());

        mockMvc.perform(post(RETURN_INSPECTION_URL)
                        .with(authentication(
                                authenticatedAs(7L, "SALES_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "lines": [
                                        {
                                            "loadItemId": 300,
                                            "quantityResellable": 3,
                                            "quantityDamaged": 2,
                                            "note": "Two items damaged"
                                        }
                                    ],
                                    "note": "Return inspection completed"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(500))
                .andExpect(jsonPath("$.attemptId").value(100))
                .andExpect(jsonPath("$.assignmentId").value(10))
                .andExpect(jsonPath("$.inspectedBy").value(7))
                .andExpect(jsonPath("$.lines[0].loadItemId").value(300))
                .andExpect(jsonPath("$.lines[0].quantityResellable").value(3))
                .andExpect(jsonPath("$.lines[0].quantityDamaged").value(2));

        verify(workflowService).inspectReturn(
                eq(100L),
                eq(7L),
                eq("SALES_STAFF"),
                any(ReturnInspectionCreateRequest.class));
    }

    @Test
    void negativeInspectionQuantityReturns400() throws Exception {

        mockMvc.perform(post(RETURN_INSPECTION_URL)
                        .with(authentication(
                                authenticatedAs(7L, "SALES_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "lines": [
                                        {
                                            "loadItemId": 300,
                                            "quantityResellable": -1,
                                            "quantityDamaged": 2,
                                            "note": "Invalid quantity"
                                        }
                                    ],
                                    "note": "Invalid inspection"
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(workflowService);
    }

    @Test
    void emptyInspectionLinesReturns400() throws Exception {

        mockMvc.perform(post(RETURN_INSPECTION_URL)
                        .with(authentication(
                                authenticatedAs(7L, "SALES_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "lines": [],
                                    "note": "Empty inspection"
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(workflowService);
    }


    @Test
    void deliveryStaffCannotInspectReturnedItems() throws Exception {

        mockMvc.perform(post(RETURN_INSPECTION_URL)
                        .with(authentication(
                                authenticatedAs(7L, "DELIVERY_STAFF"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void unauthenticatedRequestReturns401() throws Exception {

        mockMvc.perform(post(RETURN_INSPECTION_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "lines": [
                                        {
                                            "loadItemId": 300,
                                            "quantityResellable": 3,
                                            "quantityDamaged": 2,
                                            "note": "Test"
                                        }
                                    ],
                                    "note": "Test"
                                }
                                """))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(workflowService);
    }

    @Test
    void workflowConflictReturns409() throws Exception {

        when(workflowService.inspectReturn(
                eq(100L),
                eq(7L),
                eq("SALES_STAFF"),
                any(ReturnInspectionCreateRequest.class)))
                .thenThrow(new ConflictException(
                        "Return inspection already exists"));

        mockMvc.perform(post(RETURN_INSPECTION_URL)
                        .with(authentication(
                                authenticatedAs(7L, "SALES_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "lines": [
                                        {
                                            "loadItemId": 300,
                                            "quantityResellable": 3,
                                            "quantityDamaged": 2,
                                            "note": "Test"
                                        }
                                    ],
                                    "note": "Test"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message")
                        .value("Return inspection already exists"));
    }

    @Test
    void attemptNotFoundReturns404() throws Exception {

        when(workflowService.inspectReturn(
                eq(100L),
                eq(7L),
                eq("SALES_STAFF"),
                any(ReturnInspectionCreateRequest.class)))
                .thenThrow(new NotFoundException(
                        "Delivery attempt not found: 100"));

        mockMvc.perform(post(RETURN_INSPECTION_URL)
                        .with(authentication(
                                authenticatedAs(7L, "SALES_STAFF")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "lines": [
                                        {
                                            "loadItemId": 300,
                                            "quantityResellable": 3,
                                            "quantityDamaged": 2,
                                            "note": "Test"
                                        }
                                    ],
                                    "note": "Test"
                                }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message")
                        .value("Delivery attempt not found: 100"));
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

    private ReturnInspectionResponse sampleResponse() {

        ReturnInspectionResponse.Line line =
                new ReturnInspectionResponse.Line(
                        600L,
                        300L,
                        3,
                        2,
                        "Two items damaged");

        return new ReturnInspectionResponse(
                500L,
                100L,
                10L,
                7L,
                OffsetDateTime.parse("2026-11-02T18:00:00+07:00"),
                "Return inspection completed",
                List.of(line));
    }
}
