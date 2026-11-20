package com.aquaflow.customer.order.application;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class OrderCodesTest {

    @Test
    void generatesShortCodesWithoutConfusableCharacters() {
        for (int i = 0; i < 1000; i++) {
            assertThat(OrderCodes.generate()).matches(OrderCodes.PATTERN).doesNotContainPattern("[01OIL]");
        }
    }

    @Test
    void codesAreNotSequential() {
        Set<String> codes = new HashSet<>();
        for (int i = 0; i < 1000; i++) codes.add(OrderCodes.generate());
        assertThat(codes).hasSizeGreaterThan(990);
    }
}
