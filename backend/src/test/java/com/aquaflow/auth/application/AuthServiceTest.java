package com.aquaflow.auth.application;

import com.aquaflow.auth.api.dto.LoginRequest;
import com.aquaflow.auth.api.dto.LoginResponse;
import com.aquaflow.auth.domain.Role;
import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.domain.UserStatus;
import com.aquaflow.auth.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @InjectMocks
    private AuthService authService;

    @Test
    void loginReturnsJwtForActiveUserWithValidPassword() {
        User user = user(UserStatus.ACTIVE);
        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("correct-password", "encoded-password")).thenReturn(true);
        when(jwtService.generateToken(user)).thenReturn("jwt-token");
        when(jwtService.expirationSeconds()).thenReturn(3600L);

        LoginResponse response = authService.login(new LoginRequest(" ADMIN@example.com ", "correct-password"));

        assertThat(response.accessToken()).isEqualTo("jwt-token");
        assertThat(response.tokenType()).isEqualTo("Bearer");
        assertThat(response.expiresIn()).isEqualTo(3600L);
        assertThat(response.user().role()).isEqualTo("ADMIN");
    }

    @Test
    void loginRejectsInvalidPassword() {
        User user = user(UserStatus.ACTIVE);
        when(userRepository.findByEmailIgnoreCase("admin@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "encoded-password")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("admin@example.com", "wrong-password")))
                .isInstanceOf(InvalidCredentialsException.class);
        verify(jwtService, never()).generateToken(user);
    }

    @Test
    void loginRejectsInactiveUserWithoutCheckingPassword() {
        User user = user(UserStatus.INACTIVE);
        when(userRepository.findByEmailIgnoreCase(eq("admin@example.com"))).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(new LoginRequest("admin@example.com", "correct-password")))
                .isInstanceOf(InvalidCredentialsException.class);
        verify(passwordEncoder, never()).matches("correct-password", "encoded-password");
    }

    private User user(UserStatus status) {
        return new User(
                new Role("ADMIN", "Administrator"),
                "Admin User",
                "admin@example.com",
                "0900000000",
                "encoded-password",
                status);
    }
}
