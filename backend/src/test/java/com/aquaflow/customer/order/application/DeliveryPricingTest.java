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

    @ParameterizedTest
    @CsvSource({"4,4,0,20000", "5,5,0,0", "5,5,1,5000", "5,2,2,14000", "5,2,9,14000", "4,1,0,20000"})
    void usesTheStoreFees(long units, long jugs, int floor, String expected) {
        // Miễn phí từ 5 bình/thùng, đơn nhỏ 20.000 ₫; lầu 1 là 1.000 ₫/bình, từ lầu 2 trở lên 7.000 ₫/bình.
        var fees = new com.aquaflow.workspace.api.DeliveryFees(5, 20_000, java.util.List.of(1_000, 7_000));
        assertThat(DeliveryPricing.calculate(BigDecimal.ONE, units, jugs, floor, fees).deliveryFee()).isEqualByComparingTo(expected);
    }

    @org.junit.jupiter.api.Test
    void defaultFeesKeepTheRulesUsedBeforeTheyWereConfigurable() {
        assertThat(DeliveryPricing.calculate(BigDecimal.ONE, 2, 2, 3, null).deliveryFee())
                .isEqualByComparingTo(DeliveryPricing.calculate(BigDecimal.ONE, 2, 2, 3).deliveryFee())
                .isEqualByComparingTo("31000");
    }
}
