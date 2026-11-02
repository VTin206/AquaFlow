package com.aquaflow.delivery.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.Objects;

@Entity
@Table(name = "delivery_attempts")
public class DeliveryAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "assignment_id", nullable = false)
    private Long assignmentId;

    @Column(name = "attempt_no", nullable = false)
    private Integer attemptNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DeliveryAttemptOutcome outcome;

    @Column(name = "recipient_name", length = 150)
    private String recipientName;

    @Column(name = "attempted_at", nullable = false)
    private OffsetDateTime attemptedAt;

    @Column(name = "failure_reason", columnDefinition = "TEXT")
    private String failureReason;

    @Column(columnDefinition = "TEXT")
    private String note;

    protected DeliveryAttempt() {
    }

    public DeliveryAttempt(
            Long assignmentId,
            Integer attemptNo,
            DeliveryAttemptOutcome outcome,
            String recipientName,
            OffsetDateTime attemptedAt,
            String failureReason,
            String note) {

        if (assignmentId == null || assignmentId <= 0) {
            throw new IllegalArgumentException(
                    "Assignment ID must be positive");
        }

        if (attemptNo == null || attemptNo <= 0) {
            throw new IllegalArgumentException(
                    "Attempt number must be positive");
        }

        this.assignmentId = assignmentId;
        this.attemptNo = attemptNo;
        this.outcome = Objects.requireNonNull(
                outcome,
                "Delivery attempt outcome is required");

        this.recipientName = recipientName;
        this.attemptedAt = attemptedAt != null
                ? attemptedAt
                : OffsetDateTime.now();

        this.failureReason = failureReason;
        this.note = note;
    }

    public Long getId() {
        return id;
    }

    public Long getAssignmentId() {
        return assignmentId;
    }

    public Integer getAttemptNo() {
        return attemptNo;
    }

    public DeliveryAttemptOutcome getOutcome() {
        return outcome;
    }

    public String getRecipientName() {
        return recipientName;
    }

    public OffsetDateTime getAttemptedAt() {
        return attemptedAt;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public String getNote() {
        return note;
    }
}
