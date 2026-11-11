package com.aquaflow.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Luồng refresh token qua HTTP trên PostgreSQL thật: cookie, xoay vòng, phát hiện dùng lại, đăng xuất, đổi mật khẩu. */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class RefreshTokenPostgresIntegrationTest {

    private static final String PASSWORD = "correct-password";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper json;

    private String email;
    private long userId;

    @BeforeEach
    void setUp() {
        jdbc.update("INSERT INTO roles(code,name) VALUES ('SALES_STAFF','Sales') ON CONFLICT (code) DO NOTHING");
        email = UUID.randomUUID() + "@refresh.test";
        userId = jdbc.queryForObject("INSERT INTO users(role_id,full_name,email,password_hash) VALUES "
                        + "((SELECT id FROM roles WHERE code='SALES_STAFF'),'Refresh tester',?,?) RETURNING id",
                Long.class, email, passwordEncoder.encode(PASSWORD));
    }

    @AfterEach
    void tearDown() {
        jdbc.update("DELETE FROM users WHERE id = ?", userId);
    }

    @Test
    void loginSetsAHardenedCookieThatRotatesIntoANewAccessToken() throws Exception {
        MvcResult login = login();
        String setCookie = login.getResponse().getHeader(HttpHeaders.SET_COOKIE);
        assertThat(setCookie)
                .startsWith("af_refresh=")
                .contains("Path=/api/v1/auth", "HttpOnly", "SameSite=Strict", "Secure", "Max-Age=1209600");
        // Refresh token chỉ nằm trong cookie, không có trong body để JavaScript không đọc được.
        assertThat(login.getResponse().getContentAsString()).doesNotContain(cookieValue(login));
        assertThat(jdbc.queryForObject("SELECT token_hash FROM refresh_tokens WHERE user_id = ?", String.class, userId))
                .hasSize(64).isNotEqualTo(cookieValue(login));

        MvcResult refreshed = refresh(cookieValue(login)).andExpect(status().isOk()).andReturn();
        assertThat(cookieValue(refreshed)).isNotBlank().isNotEqualTo(cookieValue(login));
        mvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken(refreshed)))
                .andExpect(status().isOk());
    }

    @Test
    void concurrentRefreshFromAnotherTabDoesNotEndTheSession() throws Exception {
        String first = cookieValue(login());
        String second = cookieValue(refresh(first).andExpect(status().isOk()).andReturn());

        // Tab chậm gửi token vừa bị thay: bị từ chối nhưng không xóa cookie (có thể đã là token mới của tab kia),
        // và token mới vẫn dùng được.
        MvcResult raced = refresh(first).andExpect(status().isUnauthorized()).andReturn();
        assertThat(raced.getResponse().getHeader(HttpHeaders.SET_COOKIE)).isNull();
        String third = cookieValue(refresh(second).andExpect(status().isOk()).andReturn());

        // Token hết hạn thật thì xóa cookie để trình duyệt không gửi lại mãi.
        jdbc.update("UPDATE refresh_tokens SET expires_at = now() - INTERVAL '1 second' WHERE user_id = ? AND revoked_at IS NULL", userId);
        MvcResult ended = refresh(third).andExpect(status().isUnauthorized()).andReturn();
        assertThat(ended.getResponse().getHeader(HttpHeaders.SET_COOKIE)).contains("Max-Age=0");
    }

    @Test
    void reusingAnOldTokenAfterTheGracePeriodRevokesEveryTokenOfThatLogin() throws Exception {
        String stolen = cookieValue(login());
        String current = cookieValue(refresh(stolen).andExpect(status().isOk()).andReturn());
        jdbc.update("UPDATE refresh_tokens SET revoked_at = revoked_at - INTERVAL '1 minute' WHERE user_id = ? AND revoked_at IS NOT NULL", userId);

        refresh(stolen).andExpect(status().isUnauthorized());
        refresh(current).andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL", Long.class, userId))
                .isZero();
    }

    @Test
    void logoutRevokesTheSessionAndClearsTheCookie() throws Exception {
        String token = cookieValue(login());
        String other = cookieValue(login());

        MvcResult logout = mvc.perform(post("/api/v1/auth/logout").cookie(new Cookie("af_refresh", token)))
                .andExpect(status().isNoContent()).andReturn();
        assertThat(logout.getResponse().getHeader(HttpHeaders.SET_COOKIE)).contains("Max-Age=0");

        refresh(token).andExpect(status().isUnauthorized());
        // Đăng nhập ở thiết bị khác là phiên riêng, không bị đăng xuất theo.
        refresh(other).andExpect(status().isOk());
        mvc.perform(post("/api/v1/auth/logout")).andExpect(status().isNoContent());
    }

    @Test
    void passwordChangeOrLockingTheAccountInvalidatesExistingRefreshTokens() throws Exception {
        String token = cookieValue(login());
        jdbc.update("UPDATE users SET credentials_version = credentials_version + 1 WHERE id = ?", userId);
        refresh(token).andExpect(status().isUnauthorized());

        jdbc.update("UPDATE users SET credentials_version = 0 WHERE id = ?", userId);
        String again = cookieValue(login());
        jdbc.update("UPDATE users SET status = 'INACTIVE' WHERE id = ?", userId);
        refresh(again).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh")).andExpect(status().isUnauthorized());
    }

    private MvcResult login() throws Exception {
        return mvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new java.util.HashMap<>(java.util.Map.of("email", email, "password", PASSWORD)))))
                .andExpect(status().isOk())
                .andReturn();
    }

    private org.springframework.test.web.servlet.ResultActions refresh(String cookie) throws Exception {
        return mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("af_refresh", cookie)));
    }

    private static String cookieValue(MvcResult result) {
        String header = result.getResponse().getHeader(HttpHeaders.SET_COOKIE);
        return header.substring("af_refresh=".length(), header.indexOf(';'));
    }

    private String accessToken(MvcResult result) throws Exception {
        return json.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }
}
