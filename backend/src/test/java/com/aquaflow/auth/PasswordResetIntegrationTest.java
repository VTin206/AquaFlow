package com.aquaflow.auth;

import com.aquaflow.auth.application.*;
import com.aquaflow.auth.api.dto.*;
import com.aquaflow.shared.api.BadRequestException;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.mockito.ArgumentCaptor;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named="DB_URL", matches=".+")
class PasswordResetIntegrationTest {
    @Autowired PasswordResetService reset;
    @Autowired CustomerRegistrationService registration;
    @Autowired AuthService auth;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @MockBean PasswordResetMail mail;
    String email;
    long id;
    static final String OLD = "Password-old-2026", NEW = "Password-new-2026";
    @BeforeEach void setup() {
        email = UUID.randomUUID()+"@reset.test";
        String phone = "0" + ThreadLocalRandom.current().nextLong(100000000, 999999999);
        id = registration.register(new RegisterRequest("Reset test", email, phone, OLD)).id();
        when(mail.available()).thenReturn(true);
    }
    @AfterEach void cleanup() {
        jdbc.update("DELETE FROM customers WHERE user_id=?", id);
        jdbc.update("DELETE FROM users WHERE id=?", id);
    }
    String issue() {
        reset.request(email);
        var capture = ArgumentCaptor.forClass(String.class);
        verify(mail, atLeastOnce()).send(eq(email), capture.capture());
        return capture.getValue();
    }
    @Test void resetIsSingleUseAndInvalidatesJwtAndOldPassword() throws Exception {
        String jwt = auth.login(new LoginRequest(email, OLD)).accessToken();
        String token = issue();
        String stored = jdbc.queryForObject("SELECT token_hash FROM password_resets WHERE user_id=?", String.class, id);
        assertThat(stored).isNotEqualTo(token).isEqualTo(PasswordResetService.hash(token));
        mvc.perform(post("/api/v1/auth/password-resets").contentType("application/json")
                .content("{\"token\":\""+token+"\",\"password\":\""+NEW+"\"}"))
                .andExpect(status().isNoContent());
        assertThatThrownBy(() -> reset.reset(token, NEW)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> auth.login(new LoginRequest(email, OLD))).isInstanceOf(InvalidCredentialsException.class);
        assertThat(auth.login(new LoginRequest(email, NEW)).accessToken()).isNotBlank();
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer "+jwt)).andExpect(status().isUnauthorized());
    }
    @Test void expiredTokenAndTokenFromBeforeAnAdminPasswordChangeAreRejected() {
        String token = issue();
        jdbc.update("UPDATE password_resets SET expires_at=now()-interval '1 minute' WHERE user_id=?", id);
        assertThatThrownBy(() -> reset.reset(token, NEW)).isInstanceOf(BadRequestException.class);
        jdbc.update("UPDATE password_resets SET expires_at=now()+interval '15 minute' WHERE user_id=?", id);
        jdbc.update("UPDATE users SET credentials_version=credentials_version+1 WHERE id=?", id);
        assertThatThrownBy(() -> reset.reset(token, NEW)).isInstanceOf(BadRequestException.class);
    }
    @Test void replacementInvalidatesPreviousLinkAndMailFailureRollsBack() {
        String first = issue();
        reset.request(email);
        verify(mail, times(1)).send(eq(email), anyString());
        jdbc.update("UPDATE password_resets SET created_at=now()-interval '2 minutes' WHERE user_id=?", id);
        String second = issue();
        assertThatThrownBy(() -> reset.reset(first, NEW)).isInstanceOf(BadRequestException.class);
        jdbc.update("UPDATE password_resets SET created_at=now()-interval '2 minutes' WHERE user_id=?", id);
        doThrow(new IllegalStateException("SMTP unavailable")).when(mail).send(eq(email), anyString());
        assertThatThrownBy(() -> reset.request(email)).isInstanceOf(IllegalStateException.class);
        reset.reset(second, NEW);
    }
    @Test void twoConcurrentResetsCannotBothSucceed() throws Exception {
        String token = issue();
        var barrier = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> action = () -> { barrier.await(); try { reset.reset(token, NEW); return true; } catch (BadRequestException e) { return false; } };
            var first = executor.submit(action); var second = executor.submit(action);
            assertThat(java.util.List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS))).containsExactlyInAnyOrder(true, false);
        }
    }
    @Test void unknownAndInactiveUsersGetNoEmailAndSameAcceptedResponse() throws Exception {
        String client = UUID.randomUUID().toString();
        for (String target : new String[]{email, "missing-"+email}) {
            mvc.perform(post("/api/v1/auth/password-reset-requests").with(r -> { r.setRemoteAddr(client); return r; })
                    .contentType("application/json").content("{\"email\":\""+target+"\"}"))
                    .andExpect(status().isAccepted()).andExpect(jsonPath("$.token").doesNotExist());
        }
        verify(mail, timeout(3000)).send(eq(email), anyString());
        reset.request("missing-"+email);
        jdbc.update("UPDATE users SET status='INACTIVE' WHERE id=?", id);
        reset.request(email);
        verify(mail, times(1)).send(anyString(), anyString());
    }
    @Test void publicValidationRateLimitAndDisabledMail() throws Exception {
        mvc.perform(post("/api/v1/auth/password-reset-requests").contentType("application/json").content("{\"email\":\"invalid\"}"))
                .andExpect(status().isBadRequest());
        String client = UUID.randomUUID().toString();
        when(mail.available()).thenReturn(false);
        for (int i=0; i<5; i++) mvc.perform(post("/api/v1/auth/password-reset-requests").with(r -> { r.setRemoteAddr(client); return r; })
                .contentType("application/json").content("{\"email\":\"missing@example.test\"}"))
                .andExpect(status().isServiceUnavailable());
        mvc.perform(post("/api/v1/auth/password-reset-requests").with(r -> { r.setRemoteAddr(client); return r; })
                .contentType("application/json").content("{\"email\":\"missing@example.test\"}"))
                .andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After", "900"));
        String token = issue();
        mvc.perform(post("/api/v1/auth/password-resets").contentType("application/json")
                .content("{\"token\":\""+token+"\",\"password\":\"short\"}"))
                .andExpect(status().isBadRequest());
        assertThatThrownBy(() -> reset.reset(token, "é".repeat(40))).isInstanceOf(BadRequestException.class);
        reset.reset(token, NEW);
    }
}
