package com.aquaflow.inventory.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Nguồn nhập của một lô, gộp từ các phiếu đã nhập kho.
 *
 * @param receiptId  phiếu nhập đầu tiên đưa lô này vào kho
 * @param received   tổng số đạt đã nhập vào lô qua mọi phiếu
 * @param unitCost   giá vốn ở phiếu đầu tiên
 */
public record LotSourceResponse(long batchId, long receiptId, Instant receivedAt, LocalDate manufacturedOn,
                                int received, BigDecimal unitCost) {
}
