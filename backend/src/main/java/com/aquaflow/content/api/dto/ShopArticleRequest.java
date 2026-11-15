package com.aquaflow.content.api.dto;

import com.aquaflow.content.domain.ShopArticle;
import com.aquaflow.content.domain.ShopArticleKind;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Thêm hoặc sửa bài viết trên trang khách.
 *
 * @param kind        chỉ dùng khi thêm; khi sửa bỏ qua (không đổi loại bài đã có).
 * @param slug        để trống thì tự sinh từ tiêu đề (bỏ dấu, nối bằng gạch ngang).
 * @param icon        khóa trong danh sách icon cố định, xem {@code ShopArticleService.ICONS}.
 * @param body        mỗi dòng một đoạn; dòng bắt đầu bằng "## " là tiêu đề nhỏ.
 * @param publishedOn ngày hiện trên tin tức; tin được đăng mà để trống thì lấy ngày hôm nay. Chính sách luôn bỏ trống.
 * @param version     bắt buộc khi sửa: phiên bản đã đọc; người khác đã sửa trước thì 409.
 */
public record ShopArticleRequest(
        ShopArticleKind kind,

        @Size(max = ShopArticle.SLUG_MAX_LENGTH, message = "Đường dẫn tối đa 120 ký tự")
        @Pattern(regexp = "^$|^[a-z0-9]+(-[a-z0-9]+)*$",
                message = "Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang giữa các từ")
        String slug,

        @NotBlank(message = "Nhập tiêu đề")
        @Size(max = ShopArticle.TITLE_MAX_LENGTH, message = "Tiêu đề tối đa 200 ký tự")
        String title,

        @NotBlank(message = "Nhập tóm tắt")
        @Size(max = ShopArticle.SUMMARY_MAX_LENGTH, message = "Tóm tắt tối đa 300 ký tự")
        String summary,

        @NotBlank(message = "Chọn icon")
        String icon,

        @NotBlank(message = "Nhập nội dung")
        @Size(max = ShopArticle.BODY_MAX_LENGTH, message = "Nội dung tối đa 20000 ký tự")
        String body,

        @NotNull(message = "Chọn đăng hoặc lưu nháp")
        Boolean published,

        LocalDate publishedOn,

        @PositiveOrZero
        Long version) {
}
