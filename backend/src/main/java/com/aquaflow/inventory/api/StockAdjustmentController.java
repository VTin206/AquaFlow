package com.aquaflow.inventory.api;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.inventory.api.dto.StockAdjustmentDtos.Create;
import com.aquaflow.inventory.api.dto.StockAdjustmentDtos.Response;
import com.aquaflow.inventory.application.StockAdjustmentService;
import io.swagger.v3.oas.annotations.Operation;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/inventory/adjustments")
@Tag(name = "Inventory adjustments")
@SecurityRequirement(name = "bearerAuth")
public class StockAdjustmentController {
    private final StockAdjustmentService service;

    public StockAdjustmentController(StockAdjustmentService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(summary = "Stocktake one batch: set on-hand to the counted quantity (ADMIN)")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Adjustment recorded"),
            @ApiResponse(responseCode = "400", description = "Counted quantity equals on-hand or invalid input", content =
                    @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
            @ApiResponse(responseCode = "404", description = "Batch not found", content =
                    @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
            @ApiResponse(responseCode = "409", description = "Counted quantity is below the reserved quantity", content =
                    @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<Response> adjust(@Valid @RequestBody Create request, @AuthenticationPrincipal AuthUserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.adjust(request, principal.user().getId()));
    }
}
