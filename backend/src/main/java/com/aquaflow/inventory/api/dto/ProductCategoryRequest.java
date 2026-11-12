package com.aquaflow.inventory.api.dto;

import com.aquaflow.inventory.domain.ProductCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Thêm hoặc sửa loại sản phẩm.
 *
 * @param active chỉ dùng khi sửa: false là ngừng dùng, true là dùng lại; thiếu thì giữ nguyên. Loại mới luôn đang dùng.
 */
public record ProductCategoryRequest(
        @NotBlank(message = "Nhập tên loại sản phẩm")
        @Size(max = ProductCategory.NAME_MAX_LENGTH, message = "Tên loại sản phẩm tối đa 80 ký tự")
        String name,

        Boolean active) {
}
