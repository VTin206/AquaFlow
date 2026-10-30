package com.aquaflow.inventory.application;

import com.aquaflow.inventory.domain.InventoryBalance;
import com.aquaflow.inventory.domain.Product;
import com.aquaflow.inventory.domain.ProductBatch;
import com.aquaflow.inventory.domain.StockReservation;
import com.aquaflow.inventory.repository.InventoryBalanceRepository;
import com.aquaflow.inventory.repository.StockReservationRepository;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StockReservationServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 24);

    @Mock private InventoryBalanceRepository balanceRepository;
    @Mock private StockReservationRepository reservationRepository;

    private StockReservationService service;
    private Product product;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-24T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
        service = new StockReservationService(balanceRepository, reservationRepository, clock);
        product = withId(new Product("N19", "Nước 19L", null, "binh", null, null, new BigDecimal("20000")), 10L);
    }

    @Test
    void reserveTakesEarliestExpiringBatchFirst() {
        InventoryBalance soon = balance(100L, "SOON", TODAY.plusDays(5), 3, 0);
        InventoryBalance later = balance(101L, "LATER", TODAY.plusDays(60), 10, 0);
        // Repository trả về theo FEFO (expires_on tăng dần)
        when(balanceRepository.lockSellableByProductFefo(10L, TODAY)).thenReturn(List.of(soon, later));
        when(reservationRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        List<StockReservation> result = service.reserve(List.of(new ReservationLine(1L, 10L, 5)));

        assertThat(result).extracting(r -> r.getBatch().getLotCode(), StockReservation::getQuantityReserved)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("SOON", 3), org.assertj.core.groups.Tuple.tuple("LATER", 2));
        assertThat(soon.getAvailable()).isZero();
        assertThat(later.getReserved()).isEqualTo(2);
    }

    @Test
    void reserveCountsAlreadyReservedQuantity() {
        InventoryBalance batch = balance(100L, "A", TODAY.plusDays(5), 10, 8);
        when(balanceRepository.lockSellableByProductFefo(10L, TODAY)).thenReturn(List.of(batch));

        assertThatThrownBy(() -> service.reserve(List.of(new ReservationLine(1L, 10L, 3))))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("chỉ còn 2");
        assertThat(batch.getReserved()).isEqualTo(8);
        verify(reservationRepository, never()).saveAll(anyList());
    }

    @Test
    void reserveFailsWhenOnlyExpiredStockLeft() {
        // Lô hết hạn bị loại ngay trong truy vấn (expires_on > today), nên repository không trả về lô nào
        when(balanceRepository.lockSellableByProductFefo(10L, TODAY)).thenReturn(List.of());

        assertThatThrownBy(() -> service.reserve(List.of(new ReservationLine(1L, 10L, 1))))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void reserveRejectsOrderItemAlreadyReserved() {
        StockReservation existing = new StockReservation(1L, batch(100L, "A", TODAY.plusDays(5)), 1);
        when(reservationRepository.findByOrderItemIdIn(List.of(1L))).thenReturn(List.of(existing));

        assertThatThrownBy(() -> service.reserve(List.of(new ReservationLine(1L, 10L, 1))))
                .isInstanceOf(ConflictException.class);
        verify(balanceRepository, never()).lockSellableByProductFefo(any(), any());
    }

    @Test
    void releaseReturnsOutstandingQuantityAndIsIdempotent() {
        InventoryBalance balance = balance(100L, "A", TODAY.plusDays(5), 10, 4);
        StockReservation reservation = new StockReservation(1L, balance.getBatch(), 4);
        when(reservationRepository.findByOrderItemIdIn(List.of(1L))).thenReturn(List.of(reservation));
        when(balanceRepository.findForUpdateByBatchId(100L)).thenReturn(Optional.of(balance));

        service.release(List.of(1L));
        service.release(List.of(1L));

        assertThat(balance.getReserved()).isZero();
        assertThat(balance.getAvailable()).isEqualTo(10);
        assertThat(reservation.getQuantityReleased()).isEqualTo(4);
    }

    @Test
    void releaseRejectsReservationsWithDispatchedQuantityWithoutChangingBalance() {
        InventoryBalance balance = balance(100L, "A", TODAY.plusDays(5), 10, 4);
        StockReservation reservation = new StockReservation(1L, balance.getBatch(), 4);
        ReflectionTestUtils.setField(reservation, "quantityDispatched", 1);
        when(reservationRepository.findByOrderItemIdIn(List.of(1L))).thenReturn(List.of(reservation));

        assertThatThrownBy(() -> service.release(List.of(1L)))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Không thể giải phóng reservation đã có hàng xuất kho");

        assertThat(balance.getReserved()).isEqualTo(4);
        assertThat(reservation.getQuantityReleased()).isZero();
        verifyNoInteractions(balanceRepository);
    }

    private InventoryBalance balance(Long batchId, String lot, LocalDate expiresOn, int onHand, int reserved) {
        InventoryBalance balance = new InventoryBalance(batch(batchId, lot, expiresOn));
        balance.receive(onHand);
        if (reserved > 0) {
            balance.reserve(reserved);
        }
        return balance;
    }

    private ProductBatch batch(Long id, String lot, LocalDate expiresOn) {
        return withId(new ProductBatch(product, lot, null, expiresOn), id);
    }

    private static <T> T withId(T entity, Long id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }
}
