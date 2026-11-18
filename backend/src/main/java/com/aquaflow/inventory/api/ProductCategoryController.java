package com.aquaflow.inventory.api;

import com.aquaflow.inventory.api.dto.ProductCategoryRequest;
import com.aquaflow.inventory.api.dto.ProductCategoryResponse;
import com.aquaflow.inventory.application.ProductCategoryService;
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
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Loại sản phẩm cho nhân viên cửa hàng. Trang khách lấy tên loại ngay trong ProductResponse nên không cần API này. */
@RestController
@RequestMapping("/api/v1/product-categories")
@Tag(name = "Product category")
@SecurityRequirement(name = "bearerAuth")
public class ProductCategoryController {
    private final ProductCategoryService categoryService;

    public ProductCategoryController(ProductCategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    @Operation(summary = "List product categories", description = "Ordered by creation. `active` omitted: all categories.")
    public List<ProductCategoryResponse> list(@RequestParam(required = false) Boolean active) {
        return categoryService.findAll(active);
    }

    @PostMapping
    @Operation(summary = "Create product category")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Created"),
        @ApiResponse(responseCode = "400", description = "Invalid name", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "409", description = "Name already used (case-insensitive)", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<ProductCategoryResponse> create(@Valid @RequestBody ProductCategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryService.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Rename, retire or reuse a product category",
            description = "`active: false` stops it from being chosen for other products; products already in it keep it.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Updated"),
        @ApiResponse(responseCode = "404", description = "Category not found", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "409", description = "Name already used (case-insensitive)", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ProductCategoryResponse update(@PathVariable Long id, @Valid @RequestBody ProductCategoryRequest request) {
        return categoryService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete an unused product category")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Deleted"),
        @ApiResponse(responseCode = "404", description = "Category not found", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "409", description = "Category still has products", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        categoryService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
