package com.aquaflow.inventory.api;

import com.aquaflow.inventory.api.dto.SupplierRequest;
import com.aquaflow.inventory.api.dto.SupplierResponse;
import com.aquaflow.inventory.application.SupplierService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/suppliers")
@Tag(name = "Suppliers")
@SecurityRequirement(name = "bearerAuth")
public class SupplierController {
    private final SupplierService supplierService;

    public SupplierController(SupplierService supplierService) {
        this.supplierService = supplierService;
    }

    @GetMapping
    @Operation(summary = "Get all suppliers")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List of suppliers"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin or sales staff role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<List<SupplierResponse>> getAllSuppliers(@RequestParam(required = false) Boolean active) {
        return ResponseEntity.ok(supplierService.findAll(active));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get suppliers by ID")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Success retrieval of supplier"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin or sales staff role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "404", description = "Supplier not found", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<SupplierResponse> getSupplierById(@PathVariable Long id){
        return ResponseEntity.ok(supplierService.findById(id));
    }
    
    @PostMapping
    @Operation(summary = "Create new supplier")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Success creation of new supplier"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "400", description = "Invalid request", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<SupplierResponse> createSupplier(@Valid @RequestBody SupplierRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(supplierService.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update supplier by ID")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Success update of supplier"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "400", description = "Invalid request", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "404", description = "Supplier not found", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<SupplierResponse> updateSupplier(@PathVariable Long id, @Valid @RequestBody SupplierRequest request) {
        return ResponseEntity.ok(supplierService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete supplier by ID")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Success deletion of supplier"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "404", description = "Supplier not found", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<Void> deleteSupplier(@PathVariable Long id) {
        supplierService.delete(id);
        return ResponseEntity.noContent().build();
    }
}