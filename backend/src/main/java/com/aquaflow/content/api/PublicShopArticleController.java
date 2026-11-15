package com.aquaflow.content.api;

import com.aquaflow.content.api.dto.PublicShopArticle;
import com.aquaflow.content.application.ShopArticleService;
import com.aquaflow.content.domain.ShopArticleKind;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Tin tức và chính sách đã đăng cho trang khách; không cần đăng nhập. */
@RestController
@RequestMapping("/api/v1/shop-articles")
@Tag(name = "Shop article (public)")
public class PublicShopArticleController {
    private final ShopArticleService service;

    public PublicShopArticleController(ShopArticleService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "List published articles of one kind",
            description = "NEWS: newest first. POLICY: footer order. `body` is null in the list.")
    public List<PublicShopArticle> list(@RequestParam ShopArticleKind kind) {
        return service.findPublished(kind);
    }

    @GetMapping("/{slug}")
    @Operation(summary = "Read one published article")
    @ApiResponse(responseCode = "404", description = "Not found or not published",
            content = @Content(schema = @Schema(ref = "#/components/schemas/ApiError")))
    public PublicShopArticle get(@PathVariable String slug) {
        return service.findPublished(slug);
    }
}
