package com.aquaflow.delivery.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.delivery.application.DeliveryBottleService;
import com.aquaflow.delivery.application.DeliveryBottleService.*;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.net.URI;

@RestController
@RequestMapping("/api/v1/delivery/assignments/{id}")
public class DeliveryBottleController {
    private final DeliveryBottleService service;
    public DeliveryBottleController(DeliveryBottleService service) { this.service=service; }
    private boolean staff(Authentication auth) { return auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_SALES_STAFF")); }
    @GetMapping("/bottles") public View view(@PathVariable long id,@AuthenticationPrincipal AuthUserDetails user,Authentication auth) {
        return service.view(id,user.user().getId(),staff(auth));
    }
    @PostMapping("/bottle-returns") public ResponseEntity<View> receive(@PathVariable long id,@Valid @RequestBody ReturnRequest request,@AuthenticationPrincipal AuthUserDetails user,Authentication auth) {
        return ResponseEntity.created(URI.create("/api/v1/delivery/assignments/"+id+"/bottle-returns/"+request.requestId())).body(service.receive(id,user.user().getId(),staff(auth),request));
    }
    @GetMapping("/bottle-returns/{requestId}") public ReturnReceipt receipt(@PathVariable long id,@PathVariable java.util.UUID requestId,@AuthenticationPrincipal AuthUserDetails user,Authentication auth) {
        return service.receipt(id,requestId,user.user().getId(),staff(auth));
    }
}
