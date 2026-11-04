package com.aquaflow.auth.api;

import com.aquaflow.auth.api.dto.*;
import com.aquaflow.auth.application.StaffAccountService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/staff")
@Tag(name = "Staff accounts")
@SecurityRequirement(name = "bearerAuth")
public class StaffAccountController {
    private final StaffAccountService service;
    public StaffAccountController(StaffAccountService service) { this.service = service; }
    @GetMapping public List<UserResponse> list() { return service.list(); }
    @GetMapping("/{id}") public UserResponse get(@PathVariable long id) { return service.get(id); }
    @PostMapping public ResponseEntity<UserResponse> create(@Valid @RequestBody StaffRequests.Create request) {
        var result = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/admin/staff/" + result.id())).body(result);
    }
    @PutMapping("/{id}") public UserResponse update(@PathVariable long id, @Valid @RequestBody StaffRequests.Update request) {
        return service.update(id, request);
    }
    @PutMapping("/{id}/password") public ResponseEntity<Void> password(@PathVariable long id, @Valid @RequestBody StaffRequests.Password request) {
        service.password(id, request);
        return ResponseEntity.noContent().build();
    }
}
