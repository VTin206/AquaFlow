package com.aquaflow.customer.order.application;

import java.math.BigDecimal;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.assertj.core.api.Assertions.assertThat;

class DeliveryPricingTest {
    @ParameterizedTest
    @CsvSource({"2,2,0,15000", "3,3,0,0", "2,2,1,19000", "2,2,2,23000",
            "3,3,3,24000", "3,3,4,36000", "3,3,30,36000", "1,0,4,15000", "3,1,2,4000"})
    void matchesDemoPolicy(long units, long jugs, int floor, String expected) {
        var quote = DeliveryPricing.calculate(new BigDecimal("100000"), units, jugs, floor);
        assertThat(quote.deliveryFee()).isEqualByComparingTo(expected);
        assertThat(quote.total()).isEqualByComparingTo(new BigDecimal("100000").add(new BigDecimal(expected)));
    }
}
