package com.aquaflow.customer.order.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Khách trả lại hàng đã nhận (đơn DELIVERED/COMPLETED). */
public final class OrderReturnDtos {
    private OrderReturnDtos() {
    }

    /**
     * @param restock true: hàng còn bán được, nhập lại đúng lô khách đã nhận (lô còn hạn); false: hàng hỏng, loại bỏ
     * @param refund  bắt buộc khi khách đã trả nhiều hơn giá trị đơn sau khi trừ hàng trả; số tiền do máy chủ tính
     */
    public record Create(
            @NotNull UUID requestId,
            @NotBlank @Size(max = 500) String reason,
            @NotNull Boolean restock,
            @NotEmpty @Size(max = 100) List<@Valid @NotNull Line> lines,
            @Valid Refund refund) {
        public Create {
            if (reason != null) reason = reason.trim();
        }
    }

    public record Line(@NotNull @Positive Long orderItemId, @NotNull @Positive @Max(100000) Integer quantity) {
    }

    public record Refund(@NotBlank @Pattern(regexp = "CASH|BANK_TRANSFER") String method, @Size(max = 200) String reference) {
        public Refund {
            if (reference != null) reference = reference.trim().isEmpty() ? null : reference.trim();
        }
    }

    public record LineResponse(long orderItemId, long productId, String productName, int quantity, BigDecimal unitPrice,
                               BigDecimal value) {
    }

    /** @param value giá trị hàng trả, đã chia theo giảm giá của đơn; trừ vào số phải trả của đơn */
    public record Response(long id, long orderId, String orderCode, OffsetDateTime createdAt, long performedBy,
                           String performedByName, String reason, boolean restocked, BigDecimal value, BigDecimal refunded,
                           Long refundPaymentId, List<LineResponse> lines) {
    }

    /** Số còn trả được của từng dòng hàng, để form nhận trả giới hạn số lượng. */
    public record Returnable(long orderItemId, long productId, String productName, int ordered, int returned,
                             int returnable, BigDecimal unitPrice) {
    }

    public record Summary(List<Response> returns, List<Returnable> items) {
    }
}
