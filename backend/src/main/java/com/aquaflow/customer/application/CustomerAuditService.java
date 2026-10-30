package com.aquaflow.customer.application;

import com.aquaflow.auth.security.AuthUserDetails;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class CustomerAuditService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public CustomerAuditService(
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper) {

        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public void recordUpdate(
            String entityType,
            Long entityId,
            Map<String, Object> before,
            Map<String, Object> after) {

        if (before.equals(after)) {
            return;
        }

        Long actorId = getCurrentActorId();

        String beforeJson = toJson(before);
        String afterJson = toJson(after);

        jdbcTemplate.update(
                """
                INSERT INTO audit_logs (
                    actor_id,
                    action,
                    entity_type,
                    entity_id,
                    before_json,
                    after_json
                )
                VALUES (?, ?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb))
                """,
                actorId,
                "UPDATE",
                entityType,
                entityId,
                beforeJson,
                afterJson
        );
    }

    private Long getCurrentActorId() {

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()) {

            throw new AccessDeniedException(
                    "Cannot determine the authenticated user for audit");
        }

        Object principal = authentication.getPrincipal();

        if (principal instanceof AuthUserDetails authUserDetails) {

            Long userId = authUserDetails.user().getId();

            if (userId != null) {
                return userId;
            }
        }

        throw new AccessDeniedException(
                "Cannot determine the authenticated user for audit");
    }

    private String toJson(Map<String, Object> data) {

        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(
                    "Cannot serialize audit data to JSON",
                    exception);
        }
    }
}
