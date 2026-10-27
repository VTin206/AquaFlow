package com.aquaflow.inventory.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "inventory_movements")
public class InventoryMovement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private ProductBatch batch;

    @Enumerated(EnumType.STRING)
    @Column(name = "movement_type", nullable = false, length = 30)
    private MovementType movementType;

    @Column(nullable = false)
    private Integer quantity;

    @Enumerated(EnumType.STRING)
    @Column(name = "reference_type", nullable = false, length = 30)
    private MovementReferenceType referenceType;

    @Column(name = "reference_id", nullable = false)
    private Long referenceId;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "performed_by", nullable = false)
    private Long performedBy;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected InventoryMovement() {
    }

    public InventoryMovement(ProductBatch batch, MovementType movementType, int quantity,
                             MovementReferenceType referenceType, Long referenceId, String reason, Long performedBy) {
        this.batch = batch;
        this.movementType = movementType;
        this.quantity = quantity;
        this.referenceType = referenceType;
        this.referenceId = referenceId;
        this.reason = reason;
        this.performedBy = performedBy;
        this.occurredAt = Instant.now();
    }

    public Long getId() { return id; }
    public ProductBatch getBatch() { return batch; }
    public MovementType getMovementType() { return movementType; }
    public Integer getQuantity() { return quantity; }
    public MovementReferenceType getReferenceType() { return referenceType; }
    public Long getReferenceId() { return referenceId; }
    public String getReason() { return reason; }
    public Long getPerformedBy() { return performedBy; }
    public Instant getOccurredAt() { return occurredAt; }
}
