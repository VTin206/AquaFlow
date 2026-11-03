package com.aquaflow.inventory.api;

import com.aquaflow.inventory.api.dto.InventoryMovementResponse;
import com.aquaflow.inventory.application.InventoryMovementService;
import com.aquaflow.inventory.domain.MovementType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;

@RestController
@RequestMapping("/api/v1/inventory/movements")
@Tag(name = "Inventory movements")
@SecurityRequirement(name = "bearerAuth")
public class InventoryMovementController {
    private final InventoryMovementService service;
    public InventoryMovementController(InventoryMovementService service) { this.service = service; }

    @GetMapping
    @Operation(summary = "Read inventory ledger with filters and pagination (ADMIN, SALES_STAFF)")
    public InventoryMovementService.MovementPage list(
            @RequestParam(required = false) MovementType type,
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.list(type, productId, from, to, q, page, size);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Read one immutable inventory movement")
    public InventoryMovementResponse find(@PathVariable long id) { return service.find(id); }
}
