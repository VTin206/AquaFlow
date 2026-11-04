package com.aquaflow.workspace.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.workspace.application.StoreSettingsService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/store-settings")
@io.swagger.v3.oas.annotations.tags.Tag(name="Store settings")
@io.swagger.v3.oas.annotations.security.SecurityRequirement(name="bearerAuth")
public class StoreSettingsController {
    private final StoreSettingsService service;
    public StoreSettingsController(StoreSettingsService service) { this.service = service; }

    @GetMapping
    public StoreSettingsResponse get() { return service.get(); }

    @PutMapping
    public StoreSettingsResponse update(@Valid @RequestBody UpdateStoreSettingsRequest request,
                                        @AuthenticationPrincipal AuthUserDetails user) {
        return service.update(request, user.user().getId());
    }
}
