package com.aquaflow.delivery.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "return_inspections")
public class ReturnInspection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "attempt_id", nullable = false, unique = true)
    private Long attemptId;

    @Column(name = "inspected_by", nullable = false)
    private Long inspectedBy;

    @Column(name = "inspected_at", nullable = false)
    private OffsetDateTime inspectedAt;

    @Column(columnDefinition = "TEXT")
    private String note;

    protected ReturnInspection() {
    }

    public ReturnInspection(
            Long attemptId,
            Long inspectedBy,
            String note) {

        if (attemptId == null || attemptId <= 0) {
            throw new IllegalArgumentException(
                    "Attempt ID must be positive");
        }

        if (inspectedBy == null || inspectedBy <= 0) {
            throw new IllegalArgumentException(
                    "Inspector ID must be positive");
        }

        this.attemptId = attemptId;
        this.inspectedBy = inspectedBy;
        this.inspectedAt = OffsetDateTime.now();
        this.note = note;
    }

    public Long getId() {
        return id;
    }

    public Long getAttemptId() {
        return attemptId;
    }

    public Long getInspectedBy() {
        return inspectedBy;
    }

    public OffsetDateTime getInspectedAt() {
        return inspectedAt;
    }

    public String getNote() {
        return note;
    }
}
