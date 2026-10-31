package com.aquaflow.workspace;

import com.aquaflow.auth.application.JwtService;
import com.aquaflow.auth.domain.*;
import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.shared.config.SecurityConfig;
import com.aquaflow.workspace.api.*;
import com.aquaflow.workspace.application.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.Mockito.*;
import java.util.List;

@WebMvcTest(controllers = {StoreSettingsController.class, NotificationController.class},
        properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@Import(SecurityConfig.class)
class WorkspaceControllerTest {
    @Autowired MockMvc mvc;
    @MockBean StoreSettingsService settings;
    @MockBean NotificationService notifications;
    @MockBean JwtService jwt;
    @MockBean UserDetailsService users;

    private RequestPostProcessor actor(String role, long id) {
        User account = new User(new Role(role, role), "Test", "test@example.com", null, "hash", UserStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", id);
        return user(new AuthUserDetails(account));
    }

    private static final String SETTINGS = """
            {"version":0,"settings":{"storeName":"AquaFlow","address":"","phone":"",
            "expiryWarningDays":30,"defaultLowStock":10}}
            """;

    @Test void anonymousCannotReadEitherResource() throws Exception {
        mvc.perform(get("/api/v1/store-settings")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/notifications")).andExpect(status().isUnauthorized());
    }

    @Test void settingsReadIsForStaffAndWriteIsOnlyForAdmin() throws Exception {
        for (String role : List.of("ADMIN", "SALES_STAFF", "DELIVERY_STAFF")) {
            mvc.perform(get("/api/v1/store-settings").with(actor(role, 1))).andExpect(status().isOk());
        }
        mvc.perform(get("/api/v1/store-settings").with(actor("CUSTOMER", 1))).andExpect(status().isForbidden());
        for (String role : List.of("SALES_STAFF", "DELIVERY_STAFF", "CUSTOMER")) {
            mvc.perform(put("/api/v1/store-settings").with(actor(role, 1))
                    .contentType("application/json").content(SETTINGS)).andExpect(status().isForbidden());
        }
        mvc.perform(put("/api/v1/store-settings").with(actor("ADMIN", 1))
                .contentType("application/json").content(SETTINGS)).andExpect(status().isOk());
    }

    @Test void invalidSettingsRejectedBeforeService() throws Exception {
        mvc.perform(put("/api/v1/store-settings").with(actor("ADMIN", 1))
                .contentType("application/json").content(SETTINGS.replace("\"expiryWarningDays\":30", "\"expiryWarningDays\":-1")))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/v1/store-settings").with(actor("ADMIN", 1))
                .contentType("application/json").content("{}")) .andExpect(status().isBadRequest());
        verifyNoInteractions(settings);
    }

    @Test void notificationIdentityComesFromAuthenticatedUser() throws Exception {
        mvc.perform(get("/api/v1/notifications?recipientId=99").with(actor("CUSTOMER", 7)))
                .andExpect(status().isOk());
        verify(notifications).list(7, false, 0, 20);
        mvc.perform(put("/api/v1/notifications/12/read").with(actor("CUSTOMER", 7))).andExpect(status().isOk());
        verify(notifications).markRead(12, 7);
        mvc.perform(put("/api/v1/notifications/read-all").with(actor("CUSTOMER", 7))).andExpect(status().isOk());
        verify(notifications).markAllRead(7);
    }

    @Test void onlyAdminCanPublishAndBodyIsValidated() throws Exception {
        String body = "{\"recipientId\":7,\"title\":\"Update\",\"message\":\"Hello\"}";
        mvc.perform(post("/api/v1/admin/notifications").with(actor("SALES_STAFF", 1))
                .contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/admin/notifications").with(actor("ADMIN", 1))
                .contentType("application/json").content(body)).andExpect(status().isCreated());
        mvc.perform(post("/api/v1/admin/notifications").with(actor("ADMIN", 1))
                .contentType("application/json").content("{\"recipientId\":7,\"title\":\" \",\"message\":\"x\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test void malformedQueryReturns400AndUnreadCountUsesCurrentAccount() throws Exception {
        mvc.perform(get("/api/v1/notifications?page=invalid").with(actor("CUSTOMER", 7)))
                .andExpect(status().isBadRequest());
        when(notifications.unreadCount(7)).thenReturn(3L);
        mvc.perform(get("/api/v1/notifications/unread-count").with(actor("CUSTOMER", 7)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(3));
    }

    @Test void notificationNotOwnedReturns404AndSettingsConflictReturns409() throws Exception {
        when(notifications.markRead(12, 7)).thenThrow(new com.aquaflow.shared.api.NotFoundException("Notification not found"));
        mvc.perform(put("/api/v1/notifications/12/read").with(actor("CUSTOMER", 7)))
                .andExpect(status().isNotFound());
        when(settings.update(any(), eq(1L))).thenThrow(new com.aquaflow.shared.api.ConflictException("Reload settings"));
        mvc.perform(put("/api/v1/store-settings").with(actor("ADMIN", 1))
                .contentType("application/json").content(SETTINGS)).andExpect(status().isConflict());
    }
}
