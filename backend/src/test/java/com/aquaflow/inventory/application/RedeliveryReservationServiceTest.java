package com.aquaflow.inventory.application;

import com.aquaflow.inventory.domain.Product;
import com.aquaflow.inventory.domain.ProductBatch;
import com.aquaflow.inventory.domain.StockReservation;
import com.aquaflow.inventory.repository.RedeliveryEligibilityRepository;
import com.aquaflow.inventory.repository.RedeliveryEligibilityRepository.LoadSummary;
import com.aquaflow.inventory.repository.StockReservationRepository;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RedeliveryReservationServiceTest {

    private static final List<ReservationLine> LINES = List.of(new ReservationLine(1L, 10L, 3));

    @Mock private StockReservationService reservationService;
    @Mock private StockReservationRepository reservationRepository;
    @Mock private RedeliveryEligibilityRepository eligibilityRepository;

    private RedeliveryReservationService service;
    private ProductBatch batch;

    @BeforeEach
    void setUp() {
        service = new RedeliveryReservationService(reservationService, reservationRepository, eligibilityRepository);
        Product product = new Product("N19", "Nước 19L", null, "binh", null, null, new BigDecimal("20000"));
        ReflectionTestUtils.setField(product, "id", 10L);
        batch = new ProductBatch(product, "A", null, LocalDate.of(2027, 1, 1));
        ReflectionTestUtils.setField(batch, "id", 100L);
    }

    @Test
    void reservesAgainWhenDispatchedGoodsWereFullyInspected() {
        when(reservationRepository.findByOrderItemIdIn(List.of(1L))).thenReturn(List.of(dispatched()));
        when(eligibilityRepository.summarize(List.of(1L))).thenReturn(List.of(new LoadSummary(1L, 3, 0)));

        service.reserve(LINES);

        verify(reservationService).reserveLines(LINES);
    }

    @Test
    void rejectsWhenGoodsAreStillOutsideTheWarehouse() {
        when(reservationRepository.findByOrderItemIdIn(List.of(1L))).thenReturn(List.of(dispatched()));
        when(eligibilityRepository.summarize(List.of(1L))).thenReturn(List.of(new LoadSummary(1L, 0, 3)));

        assertThatThrownBy(() -> service.reserve(LINES))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("chưa hoàn tất kiểm nhận");
        verify(reservationService, never()).reserveLines(any());
    }

    @Test
    void rejectsWhenGoodsWereDispatchedButNeverLoaded() {
        when(reservationRepository.findByOrderItemIdIn(List.of(1L))).thenReturn(List.of(dispatched()));
        when(eligibilityRepository.summarize(List.of(1L))).thenReturn(List.of());

        assertThatThrownBy(() -> service.reserve(LINES)).isInstanceOf(ConflictException.class);
        verify(reservationService, never()).reserveLines(any());
    }

    @Test
    void rejectsWhenANewReservationIsAlreadyHeld() {
        when(reservationRepository.findByOrderItemIdIn(List.of(1L)))
                .thenReturn(List.of(dispatched(), new StockReservation(1L, batch, 3)));
        when(eligibilityRepository.summarize(List.of(1L))).thenReturn(List.of(new LoadSummary(1L, 3, 0)));

        assertThatThrownBy(() -> service.reserve(LINES))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("đang có hàng được giữ");
    }

    @Test
    void rejectsItemThatWasNeverDispatched() {
        when(reservationRepository.findByOrderItemIdIn(List.of(1L))).thenReturn(List.of(new StockReservation(1L, batch, 3)));
        when(eligibilityRepository.summarize(List.of(1L))).thenReturn(List.of());

        assertThatThrownBy(() -> service.reserve(LINES))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("chưa từng xuất kho");
    }

    private StockReservation dispatched() {
        StockReservation reservation = new StockReservation(1L, batch, 3);
        reservation.dispatchOutstanding();
        return reservation;
    }
}
