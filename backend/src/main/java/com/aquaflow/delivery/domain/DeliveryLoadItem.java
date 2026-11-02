package com.aquaflow.delivery.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "delivery_load_items")
public class DeliveryLoadItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "assignment_id", nullable = false)
    private Long assignmentId;

    @Column(name = "order_item_id", nullable = false)
    private Long orderItemId;

    @Column(name = "batch_id", nullable = false)
    private Long batchId;

    @Column(name = "quantity_loaded", nullable = false)
    private Integer quantityLoaded;

    @Column(name = "quantity_delivered", nullable = false)
    private Integer quantityDelivered = 0;

    @Column(name = "quantity_returned", nullable = false)
    private Integer quantityReturned = 0;

    protected DeliveryLoadItem() {
    }

    public DeliveryLoadItem(
            Long assignmentId,
            Long orderItemId,
            Long batchId,
            int quantityLoaded) {

        requirePositive(assignmentId, "Assignment ID");
        requirePositive(orderItemId, "Order item ID");
        requirePositive(batchId, "Batch ID");

        if (quantityLoaded <= 0) {
            throw new IllegalArgumentException(
                    "Loaded quantity must be positive");
        }

        this.assignmentId = assignmentId;
        this.orderItemId = orderItemId;
        this.batchId = batchId;
        this.quantityLoaded = quantityLoaded;
        this.quantityDelivered = 0;
        this.quantityReturned = 0;
    }

    public void recordDelivered(int quantity) {
        validateRemainingQuantity(quantity, "Delivered quantity");

        this.quantityDelivered += quantity;
    }

    public void recordReturned(int quantity) {
        validateRemainingQuantity(quantity, "Returned quantity");

        this.quantityReturned += quantity;
    }

    private void validateRemainingQuantity(
            int quantity,
            String fieldName) {

        if (quantity <= 0) {
            throw new IllegalArgumentException(
                    fieldName + " must be positive");
        }

        int remaining = quantityLoaded
                - quantityDelivered
                - quantityReturned;

        if (quantity > remaining) {
            throw new IllegalArgumentException(
                    fieldName + " exceeds remaining loaded quantity");
        }
    }

    private void requirePositive(Long value, String fieldName) {
        if (value == null || value <= 0) {
            throw new IllegalArgumentException(
                    fieldName + " must be positive");
        }
    }

    public Long getId() {
        return id;
    }

    public Long getAssignmentId() {
        return assignmentId;
    }

    public Long getOrderItemId() {
        return orderItemId;
    }

    public Long getBatchId() {
        return batchId;
    }

    public Integer getQuantityLoaded() {
        return quantityLoaded;
    }

    public Integer getQuantityDelivered() {
        return quantityDelivered;
    }

    public Integer getQuantityReturned() {
        return quantityReturned;
    }

    public int getRemainingQuantity() {
        return quantityLoaded
                - quantityDelivered
                - quantityReturned;
    }
}
