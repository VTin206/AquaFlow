package com.aquaflow.inventory.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public final class ReturnDtos {
    private ReturnDtos() {}
    public record Line(long loadItemId, long batchId, String productName, String lotCode,
                       LocalDate expiresOn, int quantity, Integer sellable) {}
    public record Pending(long orderId, String orderCode, String recipientName, long assignmentId,
                          String failureReason, List<Line> lines) {}
    public record Inspection(long id, long orderId, String orderCode, long assignmentId,
                             long performedBy, OffsetDateTime createdAt, String note, List<Line> lines) {}
    public record LineInput(@NotNull @Positive Long loadItemId, @NotNull @Min(0) Integer sellable) {}
    public record Create(@NotNull @Positive Long orderId, @NotEmpty @Size(max = 500) List<@NotNull @Valid LineInput> lines,
                         @Size(max = 300) String note) {}
}
