package com.aquaflow.customer.order.application;

import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.domain.PaymentStatus;
import com.aquaflow.customer.order.repository.OrderTrackingRepository;
import com.aquaflow.shared.api.NotFoundException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderTrackingServiceTest {

    private final OrderTrackingRepository repository = mock(OrderTrackingRepository.class);
    private final OrderTrackingService service = new OrderTrackingService(repository);

    @Test
    void lookupMatchesPhoneInAnyFormatAndUppercasesCode() {
        when(repository.findByOrderCode("AF-001070")).thenReturn(Optional.of(row("0901234567", "token-1234567890abcd")));
        when(repository.items(42L)).thenReturn(List.of(
                new OrderTrackingRepository.ItemRow(1L, "Bình 20L", "Bình", 2, new BigDecimal("30000"), new BigDecimal("60000"))));

        var order = service.lookup("  af-001070 ", "+84 901-234-567");

        assertThat(order.orderCode()).isEqualTo("AF-001070");
        assertThat(order.recipientPhone()).isEqualTo("090****567");
        assertThat(order.trackingToken()).isEqualTo("token-1234567890abcd");
        assertThat(order.items()).singleElement().satisfies(item -> {
            assertThat(item.productName()).isEqualTo("Bình 20L");
            assertThat(item.quantity()).isEqualTo(2);
        });
        verify(repository, never()).issueTrackingToken(anyLong(), anyString());
    }

    @Test
    void wrongPhoneLooksLikeMissingOrder() {
        when(repository.findByOrderCode("AF-001070")).thenReturn(Optional.of(row("0901234567", "token-1234567890abcd")));

        assertThatThrownBy(() -> service.lookup("AF-001070", "0901234568"))
                .isInstanceOf(NotFoundException.class)
                .hasMessage(OrderTrackingService.NOT_FOUND);
        assertThatThrownBy(() -> service.lookup("AF-999999", "0901234567"))
                .isInstanceOf(NotFoundException.class)
                .hasMessage(OrderTrackingService.NOT_FOUND);
    }

    @Test
    void orderWithoutPhoneCannotBeLookedUpByPhone() {
        when(repository.findByOrderCode("AF-001070")).thenReturn(Optional.of(row(null, "token-1234567890abcd")));

        assertThatThrownBy(() -> service.lookup("AF-001070", "---"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void olderOrderGetsATrackingTokenOnFirstLookup() {
        when(repository.findByOrderCode("AF-000007")).thenReturn(Optional.of(row("0901234567", null)));
        when(repository.issueTrackingToken(eq(42L), anyString())).thenReturn("issued-token-123456789");

        var order = service.lookup("AF-000007", "0901234567");

        assertThat(order.trackingToken()).isEqualTo("issued-token-123456789");
    }

    @Test
    void unknownTrackingLinkReturns404() {
        when(repository.findByTrackingToken("missing-token-1234567")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.byToken("missing-token-1234567"))
                .isInstanceOf(NotFoundException.class)
                .hasMessage(OrderTrackingService.LINK_NOT_FOUND);
    }

    @Test
    void generatedTokensAreUrlSafeAndUnique() {
        String first = TrackingTokens.generate();
        assertThat(first).matches("[A-Za-z0-9_-]{43}");
        assertThat(TrackingTokens.generate()).isNotEqualTo(first);
    }

    private OrderTrackingRepository.Row row(String phone, String token) {
        OffsetDateTime now = OffsetDateTime.parse("2026-11-10T08:00:00+07:00");
        return new OrderTrackingRepository.Row(
                42L, "AF-001070", OrderStatus.CONFIRMED, FulfillmentType.DELIVERY, PaymentStatus.UNPAID, false,
                "Nguyen Van An", phone, "123 Nguyen Trai", "Phường Chợ Quán", null,
                new BigDecimal("60000"), BigDecimal.ZERO, new BigDecimal("10000"), new BigDecimal("70000"),
                BigDecimal.ZERO, new BigDecimal("70000"), now, now, null, null, token);
    }
}
