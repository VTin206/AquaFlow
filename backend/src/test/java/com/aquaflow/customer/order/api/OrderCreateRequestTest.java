package com.aquaflow.customer.order.api;

import com.aquaflow.customer.order.api.dto.OrderCreateRequest;
import com.aquaflow.customer.order.api.dto.OrderItemRequest;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderChannel;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OrderCreateRequestTest {

    private final Validator validator =
            Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void validRequestHasNoViolations() {
        OrderCreateRequest request = validRequest();

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void rejectsRequestWithoutItems() {
        OrderCreateRequest request = new OrderCreateRequest(
                5L,
                OrderChannel.WEB,
                FulfillmentType.DELIVERY,
                "Nguyen Van An",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5",
                OffsetDateTime.parse("2027-01-15T09:00:00+07:00"),
                List.of(),
                "Test order");

        assertThat(validator.validate(request))
                .anySatisfy(violation ->
                        assertThat(violation.getPropertyPath().toString())
                                .isEqualTo("items"));
    }

    @Test
    void rejectsInvalidRecipientPhone() {
        OrderCreateRequest request = new OrderCreateRequest(
                5L,
                OrderChannel.WEB,
                FulfillmentType.DELIVERY,
                "Nguyen Van An",
                "invalid-phone",
                "123 Nguyen Trai",
                "Quan 5",
                OffsetDateTime.parse("2027-01-15T09:00:00+07:00"),
                List.of(new OrderItemRequest(101L, 2)),
                "Test order");

        assertThat(validator.validate(request))
                .anySatisfy(violation -> {
                    assertThat(violation.getPropertyPath().toString())
                            .isEqualTo("recipientPhone");
                    assertThat(violation.getMessage())
                            .isEqualTo(
                                    "Recipient phone must be a valid Vietnamese phone number");
                });
    }

    @Test
    void rejectsZeroQuantityInNestedItem() {
        OrderCreateRequest request = new OrderCreateRequest(
                5L,
                OrderChannel.WEB,
                FulfillmentType.DELIVERY,
                "Nguyen Van An",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5",
                OffsetDateTime.parse("2027-01-15T09:00:00+07:00"),
                List.of(new OrderItemRequest(101L, 0)),
                "Test order");

        assertThat(validator.validate(request))
                .anySatisfy(violation -> {
                    assertThat(violation.getPropertyPath().toString())
                            .contains("quantity");
                    assertThat(violation.getMessage())
                            .isEqualTo("Quantity must be greater than zero");
                });
    }

    private OrderCreateRequest validRequest() {
        return new OrderCreateRequest(
                5L,
                OrderChannel.WEB,
                FulfillmentType.DELIVERY,
                "Nguyen Van An",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5",
                OffsetDateTime.parse("2027-01-15T09:00:00+07:00"),
                List.of(new OrderItemRequest(101L, 2)),
                "Test order");
    }
}
