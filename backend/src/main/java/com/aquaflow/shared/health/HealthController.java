package com.aquaflow.shared.health;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/health")
public class HealthController {

    private final String version;

    public HealthController(@Value("${build.version:0.0.1-SNAPSHOT}") String version) {
        this.version = version;
    }

    @GetMapping
    public HealthResponse health() {
        return new HealthResponse("UP", "AquaFlow API is running", version, Instant.now());
    }

    public record HealthResponse(String status, String message, String version, Instant timestamp) {
    }
}
