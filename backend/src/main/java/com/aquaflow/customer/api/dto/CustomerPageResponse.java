package com.aquaflow.customer.api.dto;

import java.math.BigDecimal;
import java.util.List;

/** Một trang khách. {@code totals} cộng trên mọi khách đang hoạt động (không theo bộ lọc) cho các ô tổng của trang. */
public record CustomerPageResponse(
        List<CustomerSummary> items,
        int page,
        int size,
        long total,
        int totalPages,
        Totals totals
) {
    public record Totals(long customers, BigDecimal due, long bottlesHeld, BigDecimal depositHeld) {
    }
}
