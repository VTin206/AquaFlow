package com.aquaflow.delivery.domain;

import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DeliveryAttemptDomainTest {

    @Test
    void createsSuccessfulDeliveryAttempt() {
        OffsetDateTime attemptedAt =
                OffsetDateTime.parse("2026-11-02T10:00:00+07:00");

        DeliveryAttempt attempt = new DeliveryAttempt(
                10L,
                1,
                DeliveryAttemptOutcome.SUCCESS,
                "Nguyen Van An",
                attemptedAt,
                null,
                "Giao h?ng th?nh c?ng");

        assertThat(attempt.getAssignmentId()).isEqualTo(10L);
        assertThat(attempt.getAttemptNo()).isEqualTo(1);
        assertThat(attempt.getOutcome())
                .isEqualTo(DeliveryAttemptOutcome.SUCCESS);
        assertThat(attempt.getRecipientName())
                .isEqualTo("Nguyen Van An");
        assertThat(attempt.getAttemptedAt()).isEqualTo(attemptedAt);
        assertThat(attempt.getFailureReason()).isNull();
        assertThat(attempt.getNote())
                .isEqualTo("Giao h?ng th?nh c?ng");
    }

    @Test
    void createsFailedDeliveryAttempt() {
        OffsetDateTime attemptedAt =
                OffsetDateTime.parse("2026-11-02T11:00:00+07:00");

        DeliveryAttempt attempt = new DeliveryAttempt(
                10L,
                2,
                DeliveryAttemptOutcome.FAILED,
                "Nguyen Van An",
                attemptedAt,
                "Khong lien lac duoc voi nguoi nhan",
                "Da thu goi dien hai lan");

        assertThat(attempt.getAssignmentId()).isEqualTo(10L);
        assertThat(attempt.getAttemptNo()).isEqualTo(2);
        assertThat(attempt.getOutcome())
                .isEqualTo(DeliveryAttemptOutcome.FAILED);
        assertThat(attempt.getFailureReason())
                .isEqualTo("Khong lien lac duoc voi nguoi nhan");
        assertThat(attempt.getNote())
                .isEqualTo("Da thu goi dien hai lan");
    }

    @Test
    void defaultsAttemptedAtWhenNull() {
        OffsetDateTime beforeCreation = OffsetDateTime.now();

        DeliveryAttempt attempt = new DeliveryAttempt(
                10L,
                1,
                DeliveryAttemptOutcome.SUCCESS,
                null,
                null,
                null,
                null);

        OffsetDateTime afterCreation = OffsetDateTime.now();

        assertThat(attempt.getAttemptedAt())
                .isBetween(beforeCreation, afterCreation);
    }

    @Test
    void rejectsNullAssignmentId() {
        assertThatThrownBy(() -> new DeliveryAttempt(
                null,
                1,
                DeliveryAttemptOutcome.SUCCESS,
                null,
                null,
                null,
                null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Assignment ID must be positive");
    }

    @Test
    void rejectsNonPositiveAssignmentId() {
        assertThatThrownBy(() -> new DeliveryAttempt(
                0L,
                1,
                DeliveryAttemptOutcome.SUCCESS,
                null,
                null,
                null,
                null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Assignment ID must be positive");
    }

    @Test
    void rejectsNonPositiveAttemptNo() {
        assertThatThrownBy(() -> new DeliveryAttempt(
                10L,
                0,
                DeliveryAttemptOutcome.SUCCESS,
                null,
                null,
                null,
                null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Attempt number must be positive");
    }

    @Test
    void rejectsNullOutcome() {
        assertThatThrownBy(() -> new DeliveryAttempt(
                10L,
                1,
                null,
                null,
                null,
                null,
                null))
                .isInstanceOf(NullPointerException.class)
                .hasMessage("Delivery attempt outcome is required");
    }
}
