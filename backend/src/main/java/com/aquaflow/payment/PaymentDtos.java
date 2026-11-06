package com.aquaflow.payment;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public class PaymentDtos {
    public record Create(@NotNull UUID requestId, @NotNull @DecimalMin("0.01") @Digits(integer=12,fraction=2) BigDecimal amount,
            @NotBlank @Pattern(regexp="IN|OUT") String direction,
            @NotBlank @Pattern(regexp="CASH|BANK_TRANSFER") String method,
            @Size(max=200) String reference, @Size(max=200) String note) {
        public Create {
            if (reference != null) reference = reference.trim().isEmpty() ? null : reference.trim();
            if (note != null) note = note.trim().isEmpty() ? null : note.trim();
        }
    }
    public record Balance(long orderId, String orderCode, Long customerId, String status, BigDecimal total,
            BigDecimal received, BigDecimal refunded, BigDecimal paid, BigDecimal due, BigDecimal refundDue) {}
    public record Receipt(long id, long orderId, BigDecimal amount, String direction, String method, String reference, String note,
            long recordedBy, String recordedByName, OffsetDateTime createdAt, String source) {}
    public record Payments(Balance balance, List<Receipt> payments) {}
    public record CustomerBalance(long customerId, String name, boolean active, BigDecimal due, BigDecimal refundDue) {}
}
