package com.aquaflow.delivery.api;

import com.aquaflow.auth.application.JwtService;
import com.aquaflow.auth.domain.Role;
import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.delivery.api.dto.DeliveryDispatchResponse;
import com.aquaflow.delivery.application.DeliveryDispatchService;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import com.aquaflow.shared.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        value = DeliveryDispatchController.class,
        properties = "app.jwt.secret=test-test-test-test-test-test-test-test"
)
@Import(SecurityConfig.class)
class DeliveryDispatchControllerTest {

    private static final String DISPATCH_URL =
            "/api/v1/delivery/assignments/10/dispatch";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DeliveryDispatchService deliveryDispatchService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @Test
    void salesStaffCanDispatchSuccessfully() throws Exception {
        when(deliveryDispatchService.dispatch(
                10L, 7L, "SALES_STAFF"))
                .thenReturn(sampleResponse());

        mockMvc.perform(post(DISPATCH_URL)
                        .with(authentication(
                                authenticatedAs(7L, "SALES_STAFF"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignmentId").value(10))
                .andExpect(jsonPath("$.orderId").value(20));

        verify(deliveryDispatchService)
                .dispatch(10L, 7L, "SALES_STAFF");
    }

    @Test
    void adminCanDispatchSuccessfully() throws Exception {
        when(deliveryDispatchService.dispatch(
                10L, 1L, "ADMIN"))
                .thenReturn(sampleResponse());

        mockMvc.perform(post(DISPATCH_URL)
                        .with(authentication(
                                authenticatedAs(1L, "ADMIN"))))
                .andExpect(status().isOk());

        verify(deliveryDispatchService)
                .dispatch(10L, 1L, "ADMIN");
    }


    @Test
    void deliveryStaffCannotDispatch() throws Exception {

        mockMvc.perform(post(DISPATCH_URL)
                        .with(authentication(
                                authenticatedAs(7L, "DELIVERY_STAFF"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void unauthenticatedRequestReturns401() throws Exception {
        mockMvc.perform(post(DISPATCH_URL))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void dispatchReturns409WhenServiceThrowsConflict()
            throws Exception {

        String message = "Inventory dispatch failed";

        when(deliveryDispatchService.dispatch(
                10L, 7L, "SALES_STAFF"))
                .thenThrow(new ConflictException(message));

        mockMvc.perform(post(DISPATCH_URL)
                        .with(authentication(
                                authenticatedAs(7L, "SALES_STAFF"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value(message));
    }

    @Test
    void dispatchReturns404WhenAssignmentDoesNotExist()
            throws Exception {

        when(deliveryDispatchService.dispatch(
                10L, 7L, "SALES_STAFF"))
                .thenThrow(new NotFoundException("Assignment not found"));

        mockMvc.perform(post(DISPATCH_URL)
                        .with(authentication(
                                authenticatedAs(7L, "SALES_STAFF"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message")
                        .value("Assignment not found"));
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

    private DeliveryDispatchResponse sampleResponse() {
        return new DeliveryDispatchResponse(
                10L,
                20L,
                OrderStatus.OUT_FOR_DELIVERY,
                List.of()
        );
    }
}
