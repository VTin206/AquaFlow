package com.aquaflow.auth;

import com.aquaflow.auth.application.RegistrationMail;
import com.aquaflow.auth.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailSendException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class RegistrationVerificationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @MockBean RegistrationMail mail;
    static final String PASSWORD = "Customer-test-2026";
    String email;
    String phone;
    // Mỗi test một IP riêng để giới hạn xin mã theo IP không ảnh hưởng nhau.
    String ip;

    @BeforeEach void setup() {
        email = UUID.randomUUID() + "@verify.test";
        phone = "09" + ThreadLocalRandom.current().nextLong(10_000_000, 99_999_999);
        ip = "10.9." + ThreadLocalRandom.current().nextInt(256) + "." + ThreadLocalRandom.current().nextInt(256);
        when(mail.enabled()).thenReturn(true);
    }

    @AfterEach void cleanup() {
        jdbc.update("DELETE FROM customers WHERE user_id IN (SELECT id FROM users WHERE email=?)", email);
        jdbc.update("DELETE FROM users WHERE email=?", email);
        jdbc.update("DELETE FROM registration_verifications WHERE email=?", email);
    }

    ResultActions requestCode(String address) throws Exception {
        return mvc.perform(post("/api/v1/auth/register/verification-codes").contentType("application/json")
                .with(r -> { r.setRemoteAddr(ip); return r; })
                .content(json.writeValueAsString(Map.of("email", address, "phone", phone))));
    }

    ResultActions register(String code) throws Exception {
        var body = new HashMap<String, Object>(Map.of("fullName", "Verify Test", "email", email, "phone", phone, "password", PASSWORD));
        if (code != null) body.put("verificationCode", code);
        return mvc.perform(post("/api/v1/auth/register").contentType("application/json").content(json.writeValueAsString(body)));
    }

    String sentCode() {
        var code = ArgumentCaptor.forClass(String.class);
        verify(mail, atLeastOnce()).send(eq(email), code.capture(), eq(10L));
        return code.getValue();
    }

    void allowResend() {
        jdbc.update("UPDATE registration_verifications SET sent_at=sent_at-interval '2 minutes' WHERE email=?", email);
    }

    @Test void codeIsRequiredSingleUseAndStoredHashed() throws Exception {
        requestCode(" " + email.toUpperCase() + " ").andExpect(status().isAccepted())
                .andExpect(jsonPath("$.required").value(true))
                .andExpect(jsonPath("$.expiresInSeconds").value(600))
                .andExpect(jsonPath("$.resendAfterSeconds").value(60));
        String code = sentCode();
        assertThat(code).matches("\\d{6}");
        String stored = jdbc.queryForObject("SELECT code_hash FROM registration_verifications WHERE email=?", String.class, email);
        assertThat(stored).isNotEqualTo(code);

        register(null).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(containsString("Nhập mã")));
        register("12345").andExpect(status().isBadRequest());
        assertThat(users.findByEmailIgnoreCase(email)).isEmpty();

        register(code).andExpect(status().isCreated()).andExpect(jsonPath("$.email").value(email));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM registration_verifications WHERE email=?", Integer.class, email)).isZero();
    }

    @Test void wrongCodesAreCountedAndLockTheCodeAfterFive() throws Exception {
        requestCode(email).andExpect(status().isAccepted());
        String code = sentCode();
        String wrong = code.equals("000000") ? "111111" : "000000";
        register(wrong).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(containsString("Còn 4 lần")));
        for (int i = 0; i < 4; i++) register(wrong).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT attempts FROM registration_verifications WHERE email=?", Integer.class, email)).isEqualTo(5);
        register(code).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(containsString("quá 5 lần")));
        assertThat(users.findByEmailIgnoreCase(email)).isEmpty();

        // Mã mới đặt lại số lần thử, mã cũ hết dùng được.
        allowResend();
        requestCode(email).andExpect(status().isAccepted());
        String fresh = sentCode();
        assertThat(jdbc.queryForObject("SELECT attempts FROM registration_verifications WHERE email=?", Integer.class, email)).isZero();
        if (!fresh.equals(code)) register(code).andExpect(status().isBadRequest());
        register(fresh).andExpect(status().isCreated());
    }

    @Test void resendWaitsSixtySecondsAndExpiredCodesAreRejected() throws Exception {
        requestCode(email).andExpect(status().isAccepted());
        String code = sentCode();
        requestCode(email).andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.retryAfterSeconds").isNumber());
        verify(mail, times(1)).send(eq(email), anyString(), anyLong());

        jdbc.update("UPDATE registration_verifications SET sent_at=now()-interval '11 minutes', expires_at=now()-interval '1 minute' WHERE email=?", email);
        register(code).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(containsString("hết hạn")));
    }

    @Test void takenEmailIsReportedBeforeAnyMailAndMailFailureKeepsNoCode() throws Exception {
        register(null).andExpect(status().isBadRequest());
        when(mail.enabled()).thenReturn(false);
        register(null).andExpect(status().isCreated());
        when(mail.enabled()).thenReturn(true);
        requestCode(email).andExpect(status().isConflict());
        verify(mail, never()).send(anyString(), anyString(), anyLong());

        String other = "other-" + email;
        phone = "09" + ThreadLocalRandom.current().nextLong(10_000_000, 99_999_999);
        doThrow(new MailSendException("SMTP down")).when(mail).send(eq(other), anyString(), anyLong());
        requestCode(other).andExpect(status().isServiceUnavailable());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM registration_verifications WHERE email=?", Integer.class, other)).isZero();
    }

    @Test void verificationOffNeedsNoCode() throws Exception {
        when(mail.enabled()).thenReturn(false);
        requestCode(email).andExpect(status().isAccepted()).andExpect(jsonPath("$.required").value(false));
        verify(mail, never()).send(anyString(), anyString(), anyLong());
        register(null).andExpect(status().isCreated());
    }

    private static org.hamcrest.Matcher<String> containsString(String text) {
        return org.hamcrest.Matchers.containsString(text);
    }
}
