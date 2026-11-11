package com.aquaflow.bottle;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.bottle.BottleLedgerDtos.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.ResponseEntity;
import java.net.URI;
import java.util.*;

@RestController
@RequestMapping("/api/v1/sales")
public class BottleLedgerController {
    private final BottleLedgerService service;
    public BottleLedgerController(BottleLedgerService service) { this.service=service; }
    @GetMapping("/bottle-balances") public com.aquaflow.shared.api.PageResponse<Balance> balances(@RequestParam(required=false) Integer page,
            @RequestParam(required=false) Integer size,@RequestParam(required=false) String q) {
        return service.balances(q,com.aquaflow.shared.api.PageRequestParams.of(page,size));
    }
    @GetMapping("/customers/{id}/bottle-ledger") public Ledger ledger(@PathVariable long id) { return service.ledger(id); }
    @GetMapping("/customers/{id}/bottle-transactions/{requestId}") public Entry detail(@PathVariable long id,@PathVariable UUID requestId) { return service.detail(id,requestId); }
    @PostMapping("/customers/{id}/bottle-transactions") public ResponseEntity<Entry> create(@PathVariable long id,@Valid @RequestBody Create input,@AuthenticationPrincipal AuthUserDetails user) {
        boolean admin=user.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_ADMIN"));
        var entry=service.create(id,user.user().getId(),admin,input);
        return ResponseEntity.created(URI.create("/api/v1/sales/customers/"+id+"/bottle-transactions/"+input.requestId())).body(entry);
    }
}
