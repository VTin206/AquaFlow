package com.aquaflow.content.api;

import com.aquaflow.content.api.dto.ShopArticleRequest;
import com.aquaflow.content.api.dto.ShopArticleResponse;
import com.aquaflow.content.application.ShopArticleService;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Chủ cửa hàng quản lý tin tức và chính sách trên trang khách. Quyền ADMIN theo /api/v1/admin/** ở SecurityConfig. */
@RestController
@RequestMapping("/api/v1/admin/shop-articles")
@Tag(name = "Shop article (admin)")
@SecurityRequirement(name = "bearerAuth")
public class ShopArticleController {
    private final ShopArticleService service;

    public ShopArticleController(ShopArticleService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "List all articles including drafts")
    public List<ShopArticleResponse> list() {
        return service.findAll();
    }

    @PostMapping
    @Operation(summary = "Create article", description = "Blank `slug` is generated from the title.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Created"),
        @ApiResponse(responseCode = "400", description = "Invalid input or icon", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "409", description = "Slug already used", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ResponseEntity<ShopArticleResponse> create(@Valid @RequestBody ShopArticleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Edit, publish or hide article", description = "`version` is required; `kind` is ignored.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Updated"),
        @ApiResponse(responseCode = "404", description = "Article not found", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError"))),
        @ApiResponse(responseCode = "409", description = "Stale version or slug already used", content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    })
    public ShopArticleResponse update(@PathVariable Long id, @Valid @RequestBody ShopArticleRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete article")
    @ApiResponse(responseCode = "204", description = "Deleted")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
