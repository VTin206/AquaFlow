package com.aquaflow.workspace.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.workspace.application.NotificationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class NotificationController {
    private final NotificationService service;
    public NotificationController(NotificationService service) { this.service = service; }

    @GetMapping("/notifications")
    public List<NotificationResponse> list(@AuthenticationPrincipal AuthUserDetails user,
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.list(user.user().getId(), unreadOnly, page, size);
    }

    @GetMapping("/notifications/unread-count")
    public Map<String, Long> unreadCount(@AuthenticationPrincipal AuthUserDetails user) {
        return Map.of("count", service.unreadCount(user.user().getId()));
    }

    @PutMapping("/notifications/{id}/read")
    public NotificationResponse markRead(@PathVariable long id, @AuthenticationPrincipal AuthUserDetails user) {
        return service.markRead(id, user.user().getId());
    }

    @PutMapping("/notifications/read-all")
    public Map<String, Integer> markAllRead(@AuthenticationPrincipal AuthUserDetails user) {
        return Map.of("updated", service.markAllRead(user.user().getId()));
    }

    @PostMapping("/admin/notifications")
    public ResponseEntity<NotificationResponse> create(@Valid @RequestBody CreateNotificationRequest request,
            @AuthenticationPrincipal AuthUserDetails user) {
        return ResponseEntity.status(201).body(service.create(request, user.user().getId()));
    }
}
