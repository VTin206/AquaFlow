package com.aquaflow.delivery.api;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/** API request/response models for the delivery-trip workflow. */
public final class DeliveryDtos {
    private DeliveryDtos() {}

    public record CreateTripRequest(
            @Positive Long driverId,
            @Size(max = 40) String vehicle) {}

    public record AssignDriverRequest(@NotNull @Positive Long driverId) {}

    public record AddOrderRequest(@NotNull @Positive Long orderId) {}

    public record UpdateTripRequest(@NotNull @Pattern(regexp = "CANCELLED") String status) {}
    public record DriverResponse(Long id, String name) {}
    public record AvailableOrderResponse(Long id, String orderCode, String recipientName,
                                         String deliveryAddress, boolean deliveryFailed) {}
    public record LoadLineResponse(Long productId, String productName, String unit,
                                    String lotCode, int quantity) {}

    public enum Outcome { SUCCESS, FAILED }

    public record CollectionRequest(
            @NotNull java.util.UUID requestId,
            @NotNull @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal amount,
            @NotNull @Pattern(regexp = "CASH|BANK_TRANSFER") String method,
            @NotNull @Min(0) Integer bottlesReturned) {}
    public record CollectionResponse(Long id, Long orderId, BigDecimal amount, String method,
            int bottlesReturned, Long recordedBy, OffsetDateTime createdAt) {}
    public record OrderBalance(Long orderId, BigDecimal total, BigDecimal paid, BigDecimal due, int bottlesToExchange) {}
    public record CollectionsResponse(List<CollectionResponse> receipts, List<OrderBalance> balances,
            BigDecimal cashExpected, int bottlesExpected) {}

    public record DeliveryResultRequest(
            @NotNull Outcome outcome,
            @Size(max = 150) String recipientName,
            @Size(max = 2000) String failureReason,
            @Size(max = 1000) String note) {}

    /** Manual driver-to-owner cash/bottle handover, NOT a payment transaction. */
    public record SettleTripRequest(
            @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal cashReported,
            @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal cashConfirmed,
            @NotNull @Min(0) Integer bottlesExpected,
            @NotNull @Min(0) Integer bottlesConfirmed,
            @Size(max = 2000) String note) {}

    public record AttemptResponse(
            Long id, int attemptNo, Outcome outcome,
            String recipientName, String failureReason, String note,
            OffsetDateTime attemptedAt) {}

    public record AssignmentResponse(
            Long id, Long orderId, String orderCode, String orderStatus,
            String recipientName, String recipientPhone, String deliveryAddress,
            AttemptResponse latestAttempt, List<LoadLineResponse> items,
            OffsetDateTime requestedDeliveryAt, String note) {}

    public record HandoverResponse(
            Long id, BigDecimal cashReported, BigDecimal cashConfirmed,
            int bottlesExpected, int bottlesConfirmed,
            String note, Long receivedBy, OffsetDateTime handedOverAt) {}

    public record TripResponse(
            Long id, Long driverId, String driverName, String vehicle,
            String status, OffsetDateTime createdAt,
            OffsetDateTime startedAt, OffsetDateTime endedAt,
            Long createdBy, List<AssignmentResponse> orders,
            HandoverResponse settlement) {}
}
