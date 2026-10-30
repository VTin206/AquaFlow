package com.aquaflow.inventory.api;

import com.aquaflow.inventory.api.dto.ProductStockResponse;
import com.aquaflow.inventory.application.StockService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/inventory/stock")
@Tag(name = "Inventory stock")
@SecurityRequirement(name = "bearerAuth")
public class StockController {
    private final StockService stockService;

    public StockController(StockService stockService) {
        this.stockService = stockService;
    }

    @GetMapping
    @Operation(summary = "Get on-hand, reserved and available stock of all products, by batch")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Stock per product"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin or sales staff role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<List<ProductStockResponse>> getAll() {
        return ResponseEntity.ok(stockService.findAll());
    }

    @GetMapping("/{productId}")
    @Operation(summary = "Get stock of one product, by batch (FEFO order)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Stock of the product"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin or sales staff role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "404", description = "Product not found", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<ProductStockResponse> getByProduct(@PathVariable Long productId) {
        return ResponseEntity.ok(stockService.findByProduct(productId));
    }
}
