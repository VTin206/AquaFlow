package com.aquaflow.content.api.dto;

import com.aquaflow.content.domain.ShopArticleKind;

import java.time.LocalDate;

/**
 * Bài đã đăng cho trang khách. Không có trạng thái, phiên bản hay thời điểm sửa.
 *
 * @param body null trong danh sách (chỉ cần tiêu đề, tóm tắt); có khi xem một bài.
 */
public record PublicShopArticle(
        ShopArticleKind kind,
        String slug,
        String title,
        String summary,
        String icon,
        LocalDate publishedOn,
        String body) {
}
