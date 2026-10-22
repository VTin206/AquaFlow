package com.aquaflow.customer.order.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Objects;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_code", nullable = false, unique = true, length = 50)
    private String orderCode;

    @Column(name = "customer_id")
    private Long customerId;

    @Column(name = "created_by")
    private Long createdBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderChannel channel;

    @Enumerated(EnumType.STRING)
    @Column(name = "fulfillment_type", nullable = false, length = 20)
    private FulfillmentType fulfillmentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private OrderStatus status = OrderStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 20)
    private PaymentStatus paymentStatus = PaymentStatus.UNPAID;

    @Column(name = "recipient_name", length = 150)
    private String recipientName;

    @Column(name = "recipient_phone", length = 20)
    private String recipientPhone;

    @Column(name = "delivery_address", columnDefinition = "TEXT")
    private String deliveryAddress;

    @Column(name = "delivery_area", length = 150)
    private String deliveryArea;

    @Column(name = "requested_delivery_at")
    private OffsetDateTime requestedDeliveryAt;

    @Column(name = "subtotal", nullable = false, precision = 14, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "discount_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "delivery_fee", nullable = false, precision = 14, scale = 2)
    private BigDecimal deliveryFee = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "confirmed_at")
    private OffsetDateTime confirmedAt;

    @Column(name = "cancelled_at")
    private OffsetDateTime cancelledAt;

    @Column(columnDefinition = "TEXT")
    private String note;

    protected Order() {
    }

    public Order(
            String orderCode,
            Long customerId,
            Long createdBy,
            OrderChannel channel,
            FulfillmentType fulfillmentType,
            String recipientName,
            String recipientPhone,
            String deliveryAddress,
            String deliveryArea,
            OffsetDateTime requestedDeliveryAt,
            BigDecimal deliveryFee,
            String note) {

        this.orderCode = Objects.requireNonNull(orderCode, "Order code is required");
        this.channel = Objects.requireNonNull(channel, "Order channel is required");
        this.fulfillmentType = Objects.requireNonNull(
                fulfillmentType,
                "Fulfillment type is required");

        this.customerId = customerId;
        this.createdBy = createdBy;
        this.recipientName = recipientName;
        this.recipientPhone = recipientPhone;
        this.deliveryAddress = deliveryAddress;
        this.deliveryArea = deliveryArea;
        this.requestedDeliveryAt = requestedDeliveryAt;
        this.deliveryFee = requireNonNegative(deliveryFee, "Delivery fee");
        this.note = note;
        this.status = OrderStatus.PENDING;
        this.paymentStatus = PaymentStatus.UNPAID;
        this.subtotal = BigDecimal.ZERO;
        this.discountAmount = BigDecimal.ZERO;
        this.createdAt = OffsetDateTime.now();
    }

    public void updateAmounts(
            BigDecimal subtotal,
            BigDecimal discountAmount,
            BigDecimal deliveryFee) {

        BigDecimal validatedSubtotal =
                requireNonNegative(subtotal, "Subtotal");
        BigDecimal validatedDiscount =
                requireNonNegative(discountAmount, "Discount amount");
        BigDecimal validatedDeliveryFee =
                requireNonNegative(deliveryFee, "Delivery fee");

        if (validatedDiscount.compareTo(validatedSubtotal) > 0) {
            throw new IllegalArgumentException(
                    "Discount amount cannot exceed subtotal");
        }

        this.subtotal = validatedSubtotal;
        this.discountAmount = validatedDiscount;
        this.deliveryFee = validatedDeliveryFee;
    }

    public BigDecimal getTotal() {
        return subtotal.subtract(discountAmount).add(deliveryFee);
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
        if (status == null) {
            status = OrderStatus.PENDING;
        }
        if (paymentStatus == null) {
            paymentStatus = PaymentStatus.UNPAID;
        }
        if (subtotal == null) {
            subtotal = BigDecimal.ZERO;
        }
        if (discountAmount == null) {
            discountAmount = BigDecimal.ZERO;
        }
        if (deliveryFee == null) {
            deliveryFee = BigDecimal.ZERO;
        }
    }

    private BigDecimal requireNonNegative(BigDecimal value, String fieldName) {
        Objects.requireNonNull(value, fieldName + " is required");

        if (value.signum() < 0) {
            throw new IllegalArgumentException(
                    fieldName + " cannot be negative");
        }

        return value;
    }

    public void transitionTo(OrderStatus nextStatus) {
        if (!OrderStatusPolicy.canTransition(
                this.status,
                nextStatus,
                this.fulfillmentType)) {
            throw new IllegalStateException(
                    "Invalid order status transition from "
                            + this.status
                            + " to "
                            + nextStatus);
        }

        this.status = nextStatus;

        OffsetDateTime now = OffsetDateTime.now();

        if (nextStatus == OrderStatus.CONFIRMED
                && this.confirmedAt == null) {
            this.confirmedAt = now;
        }

        if (nextStatus == OrderStatus.CANCELLED) {
            this.cancelledAt = now;
        }
    }

    public Long getId() {
        return id;
    }

    public String getOrderCode() {
        return orderCode;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public Long getCreatedBy() {
        return createdBy;
    }

    public OrderChannel getChannel() {
        return channel;
    }

    public FulfillmentType getFulfillmentType() {
        return fulfillmentType;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public PaymentStatus getPaymentStatus() {
        return paymentStatus;
    }

    public String getRecipientName() {
        return recipientName;
    }

    public String getRecipientPhone() {
        return recipientPhone;
    }

    public String getDeliveryAddress() {
        return deliveryAddress;
    }

    public String getDeliveryArea() {
        return deliveryArea;
    }

    public OffsetDateTime getRequestedDeliveryAt() {
        return requestedDeliveryAt;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public BigDecimal getDiscountAmount() {
        return discountAmount;
    }

    public BigDecimal getDeliveryFee() {
        return deliveryFee;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getConfirmedAt() {
        return confirmedAt;
    }

    public OffsetDateTime getCancelledAt() {
        return cancelledAt;
    }

    public String getNote() {
        return note;
    }
}
