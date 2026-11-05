package com.aquaflow.customer.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.customer.api.dto.*;
import com.aquaflow.customer.application.CustomerAccountService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/customer/account")
@Tag(name = "Customer Account")
@SecurityRequirement(name = "bearerAuth")
public class CustomerAccountController {
    private final CustomerAccountService service;
    public CustomerAccountController(CustomerAccountService service) { this.service = service; }

    @GetMapping("/profile")
    public CustomerAccountService.Profile profile(@AuthenticationPrincipal AuthUserDetails principal) {
        return service.profile(principal.user().getId());
    }
    @PutMapping("/profile")
    public CustomerAccountService.Profile updateProfile(@AuthenticationPrincipal AuthUserDetails principal, @Valid @RequestBody MyProfileRequest request) {
        return service.updateProfile(principal.user().getId(), request);
    }
    @GetMapping("/addresses")
    public List<CustomerAddressResponse> addresses(@AuthenticationPrincipal AuthUserDetails principal) {
        return service.addresses(principal.user().getId());
    }
    @GetMapping("/addresses/{id}")
    public CustomerAddressResponse address(@AuthenticationPrincipal AuthUserDetails principal, @PathVariable Long id) {
        return service.address(principal.user().getId(), id);
    }
    @PostMapping("/addresses")
    public ResponseEntity<CustomerAddressResponse> createAddress(@AuthenticationPrincipal AuthUserDetails principal, @Valid @RequestBody MyAddressRequest request) {
        var result = service.createAddress(principal.user().getId(), request);
        return ResponseEntity.created(URI.create("/api/v1/customer/account/addresses/" + result.id())).body(result);
    }
    @PutMapping("/addresses/{id}")
    public CustomerAddressResponse updateAddress(@AuthenticationPrincipal AuthUserDetails principal, @PathVariable Long id, @Valid @RequestBody MyAddressRequest request) {
        return service.updateAddress(principal.user().getId(), id, request);
    }
    @DeleteMapping("/addresses/{id}")
    public ResponseEntity<Void> deleteAddress(@AuthenticationPrincipal AuthUserDetails principal, @PathVariable Long id) {
        service.deleteAddress(principal.user().getId(), id);
        return ResponseEntity.noContent().build();
    }
}
