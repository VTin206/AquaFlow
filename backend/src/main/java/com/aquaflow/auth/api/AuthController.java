package com.aquaflow.auth.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    @GetMapping("/status")
    public AuthStatus status() {
        return new AuthStatus("NOT_IMPLEMENTED", "JWT authentication is reserved for the next phase");
    }

    public record AuthStatus(String status, String message) {
    }
}
