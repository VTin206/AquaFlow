package com.aquaflow.delivery.api.dto;

import com.aquaflow.delivery.domain.DeliveryAttemptOutcome;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DeliveryAttemptCreateRequestTest {

    private final Validator validator =
            Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void acceptsSuccessfulDeliveryRequest() {
        DeliveryAttemptCreateRequest request =
                new DeliveryAttemptCreateRequest(
                        DeliveryAttemptOutcome.SUCCESS,
                        "Nguyen Van An",
                        null,
                        "Giao hang thanh cong");

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void acceptsFailedDeliveryRequestWithReason() {
        DeliveryAttemptCreateRequest request =
                new DeliveryAttemptCreateRequest(
                        DeliveryAttemptOutcome.FAILED,
                        "Nguyen Van An",
                        "Khach hang khong co nha",
                        "Da goi dien nhung khong lien lac duoc");

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void rejectsRequestWithoutOutcome() {
        DeliveryAttemptCreateRequest request =
                new DeliveryAttemptCreateRequest(
                        null,
                        "Nguyen Van An",
                        null,
                        "Test");

        assertThat(validator.validate(request))
                .anySatisfy(violation -> {
                    assertThat(violation.getPropertyPath().toString())
                            .isEqualTo("outcome");

                    assertThat(violation.getMessage())
                            .isEqualTo(
                                    "Delivery attempt outcome is required");
                });
    }

    @Test
    void rejectsFailedRequestWithoutFailureReason() {
        DeliveryAttemptCreateRequest request =
                new DeliveryAttemptCreateRequest(
                        DeliveryAttemptOutcome.FAILED,
                        "Nguyen Van An",
                        null,
                        "Test");

        assertThat(validator.validate(request))
                .anySatisfy(violation -> {
                    assertThat(violation.getPropertyPath().toString())
                            .isEqualTo("failureReasonValid");
                });
    }

    @Test
    void rejectsSuccessfulRequestWithFailureReason() {
        DeliveryAttemptCreateRequest request =
                new DeliveryAttemptCreateRequest(
                        DeliveryAttemptOutcome.SUCCESS,
                        "Nguyen Van An",
                        "Khach hang khong co nha",
                        "Test");

        assertThat(validator.validate(request))
                .anySatisfy(violation -> {
                    assertThat(violation.getPropertyPath().toString())
                            .isEqualTo("failureReasonValid");
                });
    }

    @Test
    void rejectsRecipientNameLongerThan150Characters() {
        DeliveryAttemptCreateRequest request =
                new DeliveryAttemptCreateRequest(
                        DeliveryAttemptOutcome.SUCCESS,
                        "A".repeat(151),
                        null,
                        "Test");

        assertThat(validator.validate(request))
                .anySatisfy(violation -> {
                    assertThat(violation.getPropertyPath().toString())
                            .isEqualTo("recipientName");

                    assertThat(violation.getMessage())
                            .isEqualTo(
                                    "Recipient name must not exceed 150 characters");
                });
    }
}
