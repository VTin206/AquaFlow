package com.aquaflow.inventory.api.dto;

/**
 * @param productCount số sản phẩm (cả đang bán và đã ngừng) thuộc loại này; còn sản phẩm thì không xóa được.
 */
public record ProductCategoryResponse(Long id, String name, boolean active, long productCount) {
}
