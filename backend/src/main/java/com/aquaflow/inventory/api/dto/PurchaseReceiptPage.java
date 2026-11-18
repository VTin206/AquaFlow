package com.aquaflow.inventory.api.dto;

import com.aquaflow.inventory.domain.PurchaseReceiptStatus;

import java.util.List;
import java.util.Map;

/**
 * Một trang phiếu nhập (ngày nhận mới nhất trước).
 *
 * @param statusCounts số phiếu theo trạng thái trên toàn bộ phiếu, không theo bộ lọc; trạng thái chưa có phiếu là 0
 */
public record PurchaseReceiptPage(List<PurchaseReceiptResponse> items, int page, int size, long total, int totalPages,
                                  Map<PurchaseReceiptStatus, Long> statusCounts) {
}
