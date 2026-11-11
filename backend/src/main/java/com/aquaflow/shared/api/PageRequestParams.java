package com.aquaflow.shared.api;

/** Trang bắt đầu từ 0; cỡ trang giới hạn để một lần gọi không kéo cả bảng. */
public record PageRequestParams(int page, int size) {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;

    public static PageRequestParams of(Integer page, Integer size) {
        int safePage = page == null ? 0 : page;
        int safeSize = size == null ? DEFAULT_SIZE : size;
        if (safePage < 0) throw new BadRequestException("page must be 0 or greater");
        if (safeSize < 1 || safeSize > MAX_SIZE) throw new BadRequestException("size must be between 1 and " + MAX_SIZE);
        return new PageRequestParams(safePage, safeSize);
    }

    public long offset() {
        return (long) page * size;
    }

    public int totalPages(long total) {
        return (int) ((total + size - 1) / size);
    }
}
