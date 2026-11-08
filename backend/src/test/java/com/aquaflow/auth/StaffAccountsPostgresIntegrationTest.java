package com.aquaflow.auth;

import com.aquaflow.auth.api.dto.*;
import com.aquaflow.auth.application.*;
import com.aquaflow.auth.domain.UserStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
@Transactional
class StaffAccountsPostgresIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired StaffAccountService staff;
    @Autowired AuthService auth;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    private static final String PASSWORD = "Test-only-password-2026";

    @Test void adminCreatesBothRolesAndTheyLoginWithCorrectPermissions() throws Exception {
        for (String role : new String[]{"SALES_STAFF", "DELIVERY_STAFF"}) {
            String email = java.util.UUID.randomUUID()+"@staff.test";
            var request = new StaffRequests.Create("Staff Test", email, "0901234567", role, PASSWORD);
            String response = mvc.perform(post("/api/v1/admin/staff").with(user("admin").roles("ADMIN"))
                    .contentType("application/json").content(json.writeValueAsString(request)))
                .andExpect(status().isCreated()).andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.role").value(role)).andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist()).andReturn().getResponse().getContentAsString();
            long id = json.readTree(response).get("id").asLong();
            assertThat(jdbc.queryForObject("SELECT password_hash FROM users WHERE id=?", String.class, id)).isNotEqualTo(PASSWORD).startsWith("$2");
            var login = auth.login(new LoginRequest(email.toUpperCase(), PASSWORD));
            String token = "Bearer "+login.accessToken();
            mvc.perform(get("/api/v1/auth/me").header("Authorization", token)).andExpect(status().isOk()).andExpect(jsonPath("$.role").value(role));
            mvc.perform(get("/api/v1/admin/staff").header("Authorization", token)).andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/delivery/trips").header("Authorization", token)).andExpect(status().isOk());
            mvc.perform(get("/api/v1/sales/orders").header("Authorization", token)).andExpect(role.equals("SALES_STAFF") ? status().isOk() : status().isForbidden());
        }
    }

    @Test void passwordResetAndDisableInvalidateExistingTokens() throws Exception {
        String email = java.util.UUID.randomUUID()+"@staff.test";
        var account = staff.create(new StaffRequests.Create("Test", email, null, "DELIVERY_STAFF", PASSWORD));
        String first = auth.login(new LoginRequest(email, PASSWORD)).accessToken();
        mvc.perform(put("/api/v1/admin/staff/"+account.id()+"/password").with(user("admin").roles("ADMIN"))
                .contentType("application/json").content("{\"password\":\"New-test-password-2026\"}")).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer "+first)).andExpect(status().isUnauthorized());
        String second = auth.login(new LoginRequest(email, "New-test-password-2026")).accessToken();
        staff.update(account.id(), new StaffRequests.Update("Updated", "0901234567", UserStatus.INACTIVE));
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer "+second)).andExpect(status().isUnauthorized());
        staff.update(account.id(), new StaffRequests.Update("Updated", null, UserStatus.ACTIVE));
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer "+second)).andExpect(status().isUnauthorized());
        assertThat(auth.login(new LoginRequest(email, "New-test-password-2026")).user().fullName()).isEqualTo("Updated");
    }

    @Test void accessValidationDuplicateEmailAndAdminProtection() throws Exception {
        String base = "/api/v1/admin/staff";
        mvc.perform(get(base)).andExpect(status().isUnauthorized());
        mvc.perform(post(base).with(user("sales").roles("SALES_STAFF")).contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
        for (String role : new String[]{"ADMIN", "CUSTOMER"}) {
            mvc.perform(post(base).with(user("admin").roles("ADMIN")).contentType("application/json")
                .content(json.writeValueAsString(new StaffRequests.Create("Test", "test@test.com", null, role, PASSWORD))))
                .andExpect(status().isBadRequest());
        }
        var request = new StaffRequests.Create("Test", java.util.UUID.randomUUID()+"@staff.test", null, "SALES_STAFF", PASSWORD);
        staff.create(request);
        mvc.perform(post(base).with(user("admin").roles("ADMIN")).contentType("application/json")
                .content(json.writeValueAsString(request))).andExpect(status().isConflict());
        mvc.perform(get(base+"/9223372036854775807").with(user("admin").roles("ADMIN"))).andExpect(status().isNotFound());
    }
}
