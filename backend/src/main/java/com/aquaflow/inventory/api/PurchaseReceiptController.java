package com.aquaflow.inventory.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.inventory.api.dto.PurchaseReceiptRequest;
import com.aquaflow.inventory.api.dto.PurchaseReceiptResponse;
import com.aquaflow.inventory.application.PurchaseReceiptService;
import com.aquaflow.inventory.domain.PurchaseReceiptStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/purchase-receipts")
@Tag(name = "Purchase receipts")
@SecurityRequirement(name = "bearerAuth")
public class PurchaseReceiptController {
    private final PurchaseReceiptService receiptService;

    public PurchaseReceiptController(PurchaseReceiptService receiptService) {
        this.receiptService = receiptService;
    }

    @GetMapping
    @Operation(summary = "Get purchase receipts, optionally filtered by status")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List of purchase receipts"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin or sales staff role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<List<PurchaseReceiptResponse>> getAll(
            @Parameter(description = "DRAFT, CONFIRMED or CANCELLED") @RequestParam(required = false) PurchaseReceiptStatus status) {
        return ResponseEntity.ok(receiptService.findAll(status));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get purchase receipt by ID")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Purchase receipt with items"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin or sales staff role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "404", description = "Purchase receipt not found", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<PurchaseReceiptResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(receiptService.findById(id));
    }

    @PostMapping
    @Operation(summary = "Create a DRAFT purchase receipt")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Draft receipt created"),
        @ApiResponse(responseCode = "400", description = "Invalid request (quantities, lot dates)", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin or sales staff role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "404", description = "Supplier or product not found", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<PurchaseReceiptResponse> create(
            @Valid @RequestBody PurchaseReceiptRequest request,
            @AuthenticationPrincipal AuthUserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(receiptService.create(request, principal.user().getId()));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Replace a DRAFT purchase receipt")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Draft receipt updated"),
        @ApiResponse(responseCode = "400", description = "Invalid request (quantities, lot dates)", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin or sales staff role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "404", description = "Receipt, supplier or product not found", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "409", description = "Receipt is not DRAFT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<PurchaseReceiptResponse> update(@PathVariable Long id, @Valid @RequestBody PurchaseReceiptRequest request) {
        return ResponseEntity.ok(receiptService.update(id, request));
    }

    @PostMapping("/{id}/confirm")
    @Operation(summary = "Confirm receipt and add accepted quantities to stock")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Receipt confirmed, stock increased"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin or sales staff role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "404", description = "Purchase receipt not found", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "409", description = "Receipt is not DRAFT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<PurchaseReceiptResponse> confirm(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthUserDetails principal) {
        return ResponseEntity.ok(receiptService.confirm(id, principal.user().getId()));
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "Cancel a DRAFT purchase receipt")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Receipt cancelled"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin or sales staff role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "404", description = "Purchase receipt not found", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "409", description = "Receipt is not DRAFT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<PurchaseReceiptResponse> cancel(@PathVariable Long id) {
        return ResponseEntity.ok(receiptService.cancel(id));
    }
}
