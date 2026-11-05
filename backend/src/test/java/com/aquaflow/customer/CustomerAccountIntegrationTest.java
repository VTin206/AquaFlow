package com.aquaflow.customer;

import com.aquaflow.auth.api.dto.*;
import com.aquaflow.auth.application.*;
import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.customer.repository.CustomerRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
@Transactional
class CustomerAccountIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired CustomerRegistrationService registration;
    @Autowired AuthService auth;
    @Autowired UserRepository users;
    @Autowired CustomerRepository customers;
    private static final String BASE = "/api/v1/customer/account";
    private static final String PASSWORD = "Customer-test-2026";
    private String register(String phone) {
        String email = UUID.randomUUID() + "@account.test";
        registration.register(new RegisterRequest("Customer", email, phone, PASSWORD));
        return "Bearer " + auth.login(new LoginRequest(email, PASSWORD)).accessToken();
    }
    private String address(boolean isDefault) throws Exception {
        return json.writeValueAsString(Map.of("recipientName", " Người nhận ", "recipientPhone", "090 123 4567",
                "addressLine", " 12 Đường A ", "area", " Quận 1 ", "isDefault", isDefault));
    }
    private long addAddress(String token, boolean isDefault) throws Exception {
        var result = mvc.perform(post(BASE + "/addresses").header("Authorization", token).contentType("application/json").content(address(isDefault)))
                .andExpect(status().isCreated()).andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.recipientName").value("Người nhận")).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }
    @Test void profileUpdatesBothRecordsWithoutChangingEmailRoleOrCredentials() throws Exception {
        String token = register("0971111101");
        var before = mvc.perform(get(BASE + "/profile").header("Authorization", token)).andExpect(status().isOk()).andReturn();
        String email = json.readTree(before.getResponse().getContentAsString()).get("email").asText();
        var account = users.findByEmailIgnoreCase(email).orElseThrow();
        String passwordHash = account.getPasswordHash();
        mvc.perform(put(BASE + "/profile").header("Authorization", token).contentType("application/json")
                .content("{\"fullName\":\" New Name \",\"phone\":\"+84971111102\",\"role\":\"ADMIN\",\"email\":\"hijack@test.com\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.fullName").value("New Name"))
                .andExpect(jsonPath("$.phone").value("0971111102")).andExpect(jsonPath("$.email").value(email));
        assertThat(customers.findByUserId(account.getId()).orElseThrow().getFullName()).isEqualTo("New Name");
        assertThat(account.getFullName()).isEqualTo("New Name");
        assertThat(account.getPasswordHash()).isEqualTo(passwordHash);
        mvc.perform(get("/api/v1/auth/me").header("Authorization", token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("New Name")).andExpect(jsonPath("$.role").value("CUSTOMER"));
    }
    @Test void duplicatePhoneAndInvalidProfileLeaveProfileUnchanged() throws Exception {
        String token = register("0971111103"); register("0971111104");
        mvc.perform(put(BASE + "/profile").header("Authorization", token).contentType("application/json")
                .content("{\"fullName\":\"Changed\",\"phone\":\"+84971111104\"}"))
                .andExpect(status().isConflict());
        mvc.perform(put(BASE + "/profile").header("Authorization", token).contentType("application/json")
                .content("{\"fullName\":\"   \",\"phone\":\"123\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(BASE + "/profile").header("Authorization", token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Customer")).andExpect(jsonPath("$.phone").value("0971111103"));
    }
    @Test void addressLifecycleKeepsOneDefaultAndCannotAccessOtherCustomers() throws Exception {
        String owner = register("0971111105"), other = register("0971111106");
        long first = addAddress(owner, false), second = addAddress(owner, false);
        mvc.perform(get(BASE + "/addresses/" + first).header("Authorization", owner)).andExpect(jsonPath("$.isDefault").value(true));
        mvc.perform(put(BASE + "/addresses/" + second).header("Authorization", owner).contentType("application/json").content(address(true)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.isDefault").value(true));
        mvc.perform(get(BASE + "/addresses/" + first).header("Authorization", owner)).andExpect(jsonPath("$.isDefault").value(false));
        mvc.perform(get(BASE + "/addresses").header("Authorization", other)).andExpect(content().json("[]"));
        mvc.perform(get(BASE + "/addresses/" + second).header("Authorization", other)).andExpect(status().isNotFound());
        mvc.perform(put(BASE + "/addresses/" + second).header("Authorization", other).contentType("application/json").content(address(true))).andExpect(status().isNotFound());
        mvc.perform(delete(BASE + "/addresses/" + second).header("Authorization", other)).andExpect(status().isNotFound());
        mvc.perform(delete(BASE + "/addresses/" + second).header("Authorization", owner)).andExpect(status().isNoContent());
        mvc.perform(get(BASE + "/addresses/" + first).header("Authorization", owner)).andExpect(jsonPath("$.isDefault").value(true));
    }
    @Test void invalidAddressesAndInactiveCustomerAreRejected() throws Exception {
        String token = register("0971111107");
        mvc.perform(post(BASE + "/addresses").header("Authorization", token).contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(BASE + "/addresses").header("Authorization", token)).andExpect(content().json("[]"));
        var customer = customers.findAllByActiveTrue().stream().filter(c -> "0971111107".equals(c.getPhone())).findFirst().orElseThrow();
        customer.deactivate(); customers.flush();
        mvc.perform(get(BASE + "/profile").header("Authorization", token)).andExpect(status().isNotFound());
        mvc.perform(post(BASE + "/addresses").header("Authorization", token).contentType("application/json").content(address(false)))
                .andExpect(status().isNotFound());
    }
    @Test void onlyAuthenticatedCustomersCanUseAccountEndpoints() throws Exception {
        mvc.perform(get(BASE + "/profile")).andExpect(status().isUnauthorized());
        for (String role : new String[]{"ADMIN", "SALES_STAFF", "DELIVERY_STAFF"}) {
            mvc.perform(get(BASE + "/profile").with(user("staff").roles(role))).andExpect(status().isForbidden());
            mvc.perform(post(BASE + "/addresses").with(user("staff").roles(role)).contentType("application/json").content(address(false)))
                    .andExpect(status().isForbidden());
        }
    }
}
