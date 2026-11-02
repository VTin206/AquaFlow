package com.aquaflow.delivery.domain;

import com.aquaflow.auth.domain.User;
import com.aquaflow.shared.api.ConflictException;
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
@Table(name = "delivery_trips")
public class DeliveryTrip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "driver_id", nullable = false)
    private User driver;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DeliveryTripStatus status = DeliveryTripStatus.CREATED;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected DeliveryTrip() {
    }

    public DeliveryTrip(User driver, User createdBy) {
        this.driver = driver;
        this.createdBy = createdBy;
        this.status = DeliveryTripStatus.CREATED;
        this.createdAt = Instant.now();
    }

    public void changeDriver(User driver) {
        if (status != DeliveryTripStatus.CREATED) {
            throw new ConflictException("Only a CREATED trip can be updated");
        }
        this.driver = driver;
    }

    public Long getId() { return id; }
    public User getDriver() { return driver; }
    public DeliveryTripStatus getStatus() { return status; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getEndedAt() { return endedAt; }
    public User getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
}
