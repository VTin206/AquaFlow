package com.aquaflow.auth;

import com.aquaflow.auth.api.dto.LoginRequest;
import com.aquaflow.auth.application.AuthService;
import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.customer.repository.CustomerRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
@Transactional
class CustomerRegistrationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AuthService auth;
    @Autowired UserRepository users;
    @Autowired CustomerRepository customers;
    @Autowired PasswordEncoder passwords;
    private static final String PASSWORD = "Customer-test-2026";
    private String payload(String email, String phone, String password) throws Exception {
        return json.writeValueAsString(Map.of("fullName", " Customer Test ", "email", email,
                "phone", phone, "password", password, "role", "ADMIN", "status", "INACTIVE"));
    }

    @Test void registerLoginAndAccessOnlyCustomerWorkspace() throws Exception {
        String email = java.util.UUID.randomUUID()+"@customer.test";
        mvc.perform(post("/api/v1/auth/register").contentType("application/json")
                .content(payload(" " + email.toUpperCase() + " ", "+84987654321", PASSWORD)))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("CUSTOMER"))
            .andExpect(jsonPath("$.status").value("ACTIVE"))
            .andExpect(jsonPath("$.email").value(email))
            .andExpect(jsonPath("$.passwordHash").doesNotExist());
        var account = users.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(passwords.matches(PASSWORD, account.getPasswordHash())).isTrue();
        assertThat(customers.findByUserId(account.getId()).orElseThrow().getPhone()).isEqualTo("0987654321");
        String token = "Bearer " + auth.login(new LoginRequest(email, PASSWORD)).accessToken();
        mvc.perform(get("/api/v1/customer/orders").header("Authorization", token))
            .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(get("/api/v1/auth/me").header("Authorization", token)).andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("CUSTOMER"));
        for (String path : new String[]{"/api/v1/sales/orders", "/api/v1/delivery/trips", "/api/v1/admin/staff"})
            mvc.perform(get(path).header("Authorization", token)).andExpect(status().isForbidden());
    }

    @Test void duplicateEmailAndPhoneDoNotCreateAccountsOrClaimOldProfile() throws Exception {
        String email = java.util.UUID.randomUUID()+"@customer.test";
        mvc.perform(post("/api/v1/auth/register").contentType("application/json").content(payload(email, "0987654322", PASSWORD)))
            .andExpect(status().isCreated());
        long count = users.count();
        mvc.perform(post("/api/v1/auth/register").contentType("application/json").content(payload(email.toUpperCase(), "0987654323", PASSWORD)))
            .andExpect(status().isConflict());
        mvc.perform(post("/api/v1/auth/register").contentType("application/json").content(payload("other-"+email, "+84987654322", PASSWORD)))
            .andExpect(status().isConflict());
        assertThat(users.count()).isEqualTo(count);
    }

    @Test void invalidRegistrationDoesNotPersistAnything() throws Exception {
        long count = users.count();
        for (String body : new String[]{"{}", payload("not-email", "123", "short"),
                payload("valid@example.test", "0987654324", "\u00e9".repeat(40))})
            mvc.perform(post("/api/v1/auth/register").contentType("application/json").content(body)).andExpect(status().isBadRequest());
        assertThat(users.count()).isEqualTo(count);
    }
}
