package com.aquaflow.auth.application;

import com.aquaflow.auth.api.dto.LoginRequest;
import com.aquaflow.auth.api.dto.LoginResponse;
import com.aquaflow.auth.api.dto.UserResponse;
import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.auth.security.AuthUserDetails;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmailIgnoreCase(normalizeEmail(request.email()))
                .filter(User::isActive)
                .filter(candidate -> passwordEncoder.matches(request.password(), candidate.getPasswordHash()))
                .orElseThrow(InvalidCredentialsException::new);

        return new LoginResponse(
                jwtService.generateToken(user),
                "Bearer",
                jwtService.expirationSeconds(),
                toResponse(user));
    }

    @Transactional(readOnly = true)
    public UserResponse currentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new InvalidCredentialsException();
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof AuthUserDetails userDetails) {
            return toResponse(userDetails.user());
        }

        return userRepository.findByEmailIgnoreCase(normalizeEmail(authentication.getName()))
                .filter(User::isActive)
                .map(this::toResponse)
                .orElseThrow(InvalidCredentialsException::new);
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole().getCode(),
                user.getStatus().name());
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
