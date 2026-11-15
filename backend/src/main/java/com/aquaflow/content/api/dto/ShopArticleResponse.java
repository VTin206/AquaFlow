package com.aquaflow.content.api.dto;

import com.aquaflow.content.domain.ShopArticleKind;

import java.time.Instant;
import java.time.LocalDate;

/** Bài viết đầy đủ cho màn hình quản lý, gồm cả bản nháp. */
public record ShopArticleResponse(
        Long id,
        ShopArticleKind kind,
        String slug,
        String title,
        String summary,
        String icon,
        String body,
        boolean published,
        LocalDate publishedOn,
        Instant createdAt,
        Instant updatedAt,
        long version) {
}
