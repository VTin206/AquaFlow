package com.aquaflow.inventory.api;

import com.aquaflow.inventory.application.BottleTypeService;
import com.aquaflow.inventory.api.dto.BottleTypeResponse;
import com.aquaflow.inventory.api.dto.CreateBottleTypeRequest;
import com.aquaflow.inventory.api.dto.UpdateBottleTypeRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/bottle-types")
@Tag(name = "Bottle type")
public class BottleTypeController {
    private final BottleTypeService bottleTypeService;

    public BottleTypeController(BottleTypeService bottleTypeService) {
        this.bottleTypeService = bottleTypeService;
    }

    @GetMapping
    @Operation(summary = "Get all bottle types")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List of bottle types")
    })
    public ResponseEntity<List<BottleTypeResponse>> getAllBottleTypes(@RequestParam(required = false) Boolean active) {
        return ResponseEntity.ok(bottleTypeService.findAll(active));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get bottle type by id")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Success retrieval of bottle type"),
        @ApiResponse(responseCode = "404", description = "Bottle type not found", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<BottleTypeResponse> getBottleTypeById(@PathVariable Long id) {
        return ResponseEntity.ok(bottleTypeService.findById(id));
    }

    @PostMapping
    @Operation(summary = "Create new bottle type")
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Success creation of new bottle type"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "400", description = "Invalid request", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "409", description = "Bottle type name already exists", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<BottleTypeResponse> createBottleType(@Valid @RequestBody CreateBottleTypeRequest request){
        return ResponseEntity.status(HttpStatus.CREATED).body(bottleTypeService.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update bottle type")
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Success updated bottle type"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "400", description = "Invalid request", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "404", description = "Bottle type not found", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<BottleTypeResponse> updateBottleType(@PathVariable Long id, @Valid @RequestBody UpdateBottleTypeRequest request){
        return ResponseEntity.ok(bottleTypeService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete bottle type")
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Success deletion of bottle type"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "403", description = "Admin role required", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "404", description = "Bottle type not found", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<Void> deleteBottleType(@PathVariable Long id) {
        bottleTypeService.delete(id);
        return ResponseEntity.noContent().build();
    }
}