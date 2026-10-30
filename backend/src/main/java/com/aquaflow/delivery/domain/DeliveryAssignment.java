package com.aquaflow.delivery.domain;

import com.aquaflow.customer.order.domain.Order;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "delivery_assignments")
public class DeliveryAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trip_id", nullable = false)
    private DeliveryTrip trip;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "assigned_at", nullable = false, updatable = false)
    private Instant assignedAt = Instant.now();

    protected DeliveryAssignment() {
    }

    public DeliveryAssignment(DeliveryTrip trip, Order order) {
        this.trip = trip;
        this.order = order;
        this.active = true;
        this.assignedAt = Instant.now();
    }

    public Long getId() { return id; }
    public DeliveryTrip getTrip() { return trip; }
    public Order getOrder() { return order; }
    public boolean isActive() { return active; }
    public Instant getAssignedAt() { return assignedAt; }
}
