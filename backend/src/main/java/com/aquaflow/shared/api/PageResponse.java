package com.aquaflow.shared.api;

import java.util.List;

/** Một trang kết quả (trang bắt đầu từ 0), cùng dạng với các danh sách đơn và khách. */
public record PageResponse<T>(List<T> items, int page, int size, long total, int totalPages) {

    public static <T> PageResponse<T> of(List<T> items, PageRequestParams page, long total) {
        return new PageResponse<>(items, page.page(), page.size(), total, page.totalPages(total));
    }
}
