package com.aquaflow.inventory.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.inventory.api.ReturnDtos.*;
import com.aquaflow.inventory.application.InventoryReturnService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/inventory/returns")
public class InventoryReturnController {
    private final InventoryReturnService service;
    public InventoryReturnController(InventoryReturnService service) { this.service=service; }
    @GetMapping("/pending") public List<Pending> pending() { return service.pending(); }
    @GetMapping public List<Inspection> list(@RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size) { return service.list(page,size); }
    @GetMapping("/{id}") public Inspection get(@PathVariable long id) { return service.get(id); }
    @PostMapping public ResponseEntity<Inspection> create(@Valid @RequestBody Create request,
        @AuthenticationPrincipal AuthUserDetails user) {
        Inspection result=service.create(request,user.user().getId());
        return ResponseEntity.created(URI.create("/api/v1/inventory/returns/"+result.id())).body(result);
    }
}
