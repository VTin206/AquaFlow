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

    /** {@code vehicleId}: xe trong danh mục (kiểm tra xe rảnh và sức chở); {@code vehicle}: biển số gõ tay như cũ. */
    public record CreateTripRequest(
            @Positive Long driverId,
            @Size(max = 40) String vehicle,
            @Positive Long vehicleId) {
        public CreateTripRequest(Long driverId, String vehicle) { this(driverId, vehicle, null); }
    }

    /** Thêm/sửa xe. Sức chở tính theo kiện: mỗi bình, thùng hay chai trên đơn là một kiện. */
    public record VehicleRequest(
            @jakarta.validation.constraints.NotBlank @Size(max = 40) String plate,
            @Size(max = 100) String name,
            @NotNull @Min(1) @jakarta.validation.constraints.Max(10000) Integer capacity,
            Boolean active) {}

    /** {@code busyTripId}: chuyến đang giữ xe (chưa xuất phát hoặc còn đơn chưa giao xong); null là xe rảnh. */
    public record VehicleResponse(Long id, String plate, String name, int capacity, boolean active, Long busyTripId) {}

    public record AssignDriverRequest(@NotNull @Positive Long driverId) {}

    public record AddOrderRequest(@NotNull @Positive Long orderId, boolean redelivery) {
        public AddOrderRequest(Long orderId) { this(orderId, false); }
    }

    public record UpdateTripRequest(@NotNull @Pattern(regexp = "CANCELLED") String status) {}
    /** {@code busyTripId}: chuyến đang giữ tài xế; null là tài xế rảnh. */
    public record DriverResponse(Long id, String name, Long busyTripId) {
        public DriverResponse(Long id, String name) { this(id, name, null); }
    }
    public record AvailableOrderResponse(Long id, String orderCode, String recipientName,
                                         String deliveryAddress, boolean deliveryFailed,
                                         boolean redeliveryEligible) {}
    public record LoadLineResponse(Long productId, String productName, String unit,
                                    String lotCode, int quantity) {}

    public enum Outcome { SUCCESS, FAILED }

    /**
     * Thu tại điểm giao. {@code amount} là tiền hàng; {@code depositAmount} (tùy chọn, mặc định 0) là cọc vỏ
     * cho phần vỏ khách chưa đổi, ghi vào sổ cọc của khách, cùng hình thức {@code method}.
     */
    public record CollectionRequest(
            @NotNull java.util.UUID requestId,
            @NotNull @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal amount,
            @NotNull @Pattern(regexp = "CASH|BANK_TRANSFER") String method,
            @NotNull @Min(0) Integer bottlesReturned,
            @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal depositAmount) {
        public CollectionRequest {
            if (depositAmount == null) depositAmount = BigDecimal.ZERO;
        }
        public CollectionRequest(java.util.UUID requestId, BigDecimal amount, String method, Integer bottlesReturned) {
            this(requestId, amount, method, bottlesReturned, BigDecimal.ZERO);
        }
    }
    public record CollectionResponse(Long id, Long orderId, BigDecimal amount, String method,
            int bottlesReturned, Long recordedBy, OffsetDateTime createdAt, BigDecimal depositAmount) {
        public CollectionResponse(Long id, Long orderId, BigDecimal amount, String method,
                int bottlesReturned, Long recordedBy, OffsetDateTime createdAt) {
            this(id, orderId, amount, method, bottlesReturned, recordedBy, createdAt, BigDecimal.ZERO);
        }
    }
    public record OrderBalance(Long orderId, BigDecimal total, BigDecimal paid, BigDecimal due, int bottlesToExchange) {}
    /** {@code cashExpected}: tiền hàng thu tiền mặt; {@code depositExpected}: cọc thu tiền mặt, tài xế phải nộp riêng. */
    public record CollectionsResponse(List<CollectionResponse> receipts, List<OrderBalance> balances,
            BigDecimal cashExpected, int bottlesExpected, BigDecimal depositExpected) {
        public CollectionsResponse(List<CollectionResponse> receipts, List<OrderBalance> balances,
                BigDecimal cashExpected, int bottlesExpected) {
            this(receipts, balances, cashExpected, bottlesExpected, BigDecimal.ZERO);
        }
    }

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
            @Size(max = 2000) String note,
            @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal depositReported,
            @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal depositConfirmed) {
        public SettleTripRequest {
            if (depositReported == null) depositReported = BigDecimal.ZERO;
            if (depositConfirmed == null) depositConfirmed = depositReported;
        }
        public SettleTripRequest(BigDecimal cashReported, BigDecimal cashConfirmed, Integer bottlesExpected,
                Integer bottlesConfirmed, String note) {
            this(cashReported, cashConfirmed, bottlesExpected, bottlesConfirmed, note, BigDecimal.ZERO, BigDecimal.ZERO);
        }
    }

    public record AttemptResponse(
            Long id, int attemptNo, Outcome outcome,
            String recipientName, String failureReason, String note,
            OffsetDateTime attemptedAt) {}

    public record AssignmentResponse(
            Long id, Long orderId, String orderCode, String orderStatus,
            String recipientName, String recipientPhone, String deliveryAddress,
            AttemptResponse latestAttempt, List<LoadLineResponse> items,
            OffsetDateTime requestedDeliveryAt, String note,
            /** Cuối khung giờ giao; null khi hẹn một mốc giờ. */
            OffsetDateTime requestedDeliveryUntil) {}

    public record HandoverResponse(
            Long id, BigDecimal cashReported, BigDecimal cashConfirmed,
            int bottlesExpected, int bottlesConfirmed,
            String note, Long receivedBy, OffsetDateTime handedOverAt,
            BigDecimal depositReported, BigDecimal depositConfirmed) {
        public HandoverResponse(Long id, BigDecimal cashReported, BigDecimal cashConfirmed,
                int bottlesExpected, int bottlesConfirmed, String note, Long receivedBy, OffsetDateTime handedOverAt) {
            this(id, cashReported, cashConfirmed, bottlesExpected, bottlesConfirmed, note, receivedBy, handedOverAt,
                    BigDecimal.ZERO, BigDecimal.ZERO);
        }
    }

    /**
     * {@code vehicleId}/{@code vehicleCapacity}: xe trong danh mục và sức chở (kiện), null khi chuyến chỉ ghi biển số.
     * {@code loadUnits}: số kiện của các đơn đang trên chuyến.
     */
    public record TripResponse(
            Long id, Long driverId, String driverName, String vehicle,
            String status, OffsetDateTime createdAt,
            OffsetDateTime startedAt, OffsetDateTime endedAt,
            Long createdBy, List<AssignmentResponse> orders,
            HandoverResponse settlement, Long vehicleId, Integer vehicleCapacity, int loadUnits) {
        public TripResponse(Long id, Long driverId, String driverName, String vehicle, String status,
                OffsetDateTime createdAt, OffsetDateTime startedAt, OffsetDateTime endedAt, Long createdBy,
                List<AssignmentResponse> orders, HandoverResponse settlement) {
            this(id, driverId, driverName, vehicle, status, createdAt, startedAt, endedAt, createdBy, orders, settlement,
                    null, null, 0);
        }
    }
}
