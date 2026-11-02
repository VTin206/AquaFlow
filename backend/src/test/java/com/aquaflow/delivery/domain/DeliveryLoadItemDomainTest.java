package com.aquaflow.delivery.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DeliveryLoadItemDomainTest {

    @Test
    void createsDeliveryLoadItemSuccessfully() {

        DeliveryLoadItem item = new DeliveryLoadItem(
                10L,
                100L,
                5L,
                20);

        assertThat(item.getAssignmentId()).isEqualTo(10L);
        assertThat(item.getOrderItemId()).isEqualTo(100L);
        assertThat(item.getBatchId()).isEqualTo(5L);
        assertThat(item.getQuantityLoaded()).isEqualTo(20);
        assertThat(item.getQuantityDelivered()).isZero();
        assertThat(item.getQuantityReturned()).isZero();
        assertThat(item.getRemainingQuantity()).isEqualTo(20);
    }

    @Test
    void recordsDeliveredQuantitySuccessfully() {

        DeliveryLoadItem item = new DeliveryLoadItem(
                10L,
                100L,
                5L,
                20);

        item.recordDelivered(15);

        assertThat(item.getQuantityLoaded()).isEqualTo(20);
        assertThat(item.getQuantityDelivered()).isEqualTo(15);
        assertThat(item.getQuantityReturned()).isZero();
        assertThat(item.getRemainingQuantity()).isEqualTo(5);
    }

    @Test
    void recordsReturnedQuantityAfterPartialDelivery() {

        DeliveryLoadItem item = new DeliveryLoadItem(
                10L,
                100L,
                5L,
                20);

        item.recordDelivered(15);
        item.recordReturned(5);

        assertThat(item.getQuantityLoaded()).isEqualTo(20);
        assertThat(item.getQuantityDelivered()).isEqualTo(15);
        assertThat(item.getQuantityReturned()).isEqualTo(5);
        assertThat(item.getRemainingQuantity()).isZero();
    }

    @Test
    void rejectsDeliveredQuantityExceedingLoadedQuantity() {

        DeliveryLoadItem item = new DeliveryLoadItem(
                10L,
                100L,
                5L,
                20);

        assertThatThrownBy(() -> item.recordDelivered(21))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(
                        "Delivered quantity exceeds remaining loaded quantity");

        assertThat(item.getQuantityDelivered()).isZero();
    }

    @Test
    void rejectsReturnedQuantityExceedingRemainingQuantity() {

        DeliveryLoadItem item = new DeliveryLoadItem(
                10L,
                100L,
                5L,
                20);

        item.recordDelivered(15);

        assertThatThrownBy(() -> item.recordReturned(6))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(
                        "Returned quantity exceeds remaining loaded quantity");

        assertThat(item.getQuantityReturned()).isZero();
    }

    @Test
    void rejectsZeroLoadedQuantity() {

        assertThatThrownBy(() ->
                new DeliveryLoadItem(
                        10L,
                        100L,
                        5L,
                        0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Loaded quantity must be positive");
    }
}
