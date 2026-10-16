package com.aquaflow.auth.api;

import com.aquaflow.auth.domain.Role;
import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.domain.UserStatus;
import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.auth.application.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.jwt.secret=test-test-test-test-test-test-test-test",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.flywaydb.autoconfigure.FlywayAutoConfiguration"
})
@AutoConfigureMockMvc
class AuthControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private UserRepository userRepository;

    private User activeUser;

    @BeforeEach
    void setUp() {
        activeUser = new User(
                new Role("CUSTOMER", "Customer"),
                "Nguyen Van An",
                "an@example.com",
                "0900000000",
                passwordEncoder.encode("correct-password"),
                UserStatus.ACTIVE);
    }

    @Test
    void loginReturnsTokenAndUserProfile() throws Exception {
        when(userRepository.findByEmailIgnoreCase("an@example.com")).thenReturn(Optional.of(activeUser));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"an@example.com\",\"password\":\"correct-password\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.user.email").value("an@example.com"))
                .andExpect(jsonPath("$.user.role").value("CUSTOMER"));
    }

    @Test
    void invalidLoginReturns401() throws Exception {
        when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.of(activeUser));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"an@example.com\",\"password\":\"wrong-password\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Unauthorized"));
    }

    @Test
    void invalidLoginRequestReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"not-an-email\",\"password\":\"short\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void meRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.path").value("/api/v1/auth/me"));
    }

    @Test
    void customerCannotAccessAdminRoute() throws Exception {
        when(userRepository.findByEmailIgnoreCase("an@example.com")).thenReturn(Optional.of(activeUser));
        String token = jwtService.generateToken(activeUser);

        mockMvc.perform(get("/api/v1/admin/check")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.path").value("/api/v1/admin/check"));
    }

    @Test
    void meReturnsCurrentUserForValidToken() throws Exception {
        when(userRepository.findByEmailIgnoreCase("an@example.com")).thenReturn(Optional.of(activeUser));
        String token = jwtService.generateToken(activeUser);

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("an@example.com"))
                .andExpect(jsonPath("$.role").value("CUSTOMER"));
    }
}
