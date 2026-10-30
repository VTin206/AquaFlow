package com.aquaflow.inventory.application;

import com.aquaflow.inventory.domain.InventoryBalance;
import com.aquaflow.inventory.domain.InventoryMovement;
import com.aquaflow.inventory.domain.MovementType;
import com.aquaflow.inventory.domain.Product;
import com.aquaflow.inventory.domain.ProductBatch;
import com.aquaflow.inventory.domain.StockReservation;
import com.aquaflow.inventory.repository.InventoryBalanceRepository;
import com.aquaflow.inventory.repository.InventoryMovementRepository;
import com.aquaflow.inventory.repository.StockReservationRepository;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InventoryDispatchServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 24);
    private static final Long ORDER_ID = 500L;
    private static final Long USER_ID = 9L;

    @Mock private InventoryBalanceRepository balanceRepository;
    @Mock private StockReservationRepository reservationRepository;
    @Mock private InventoryMovementRepository movementRepository;

    private InventoryDispatchService service;
    private Product product;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-24T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
        service = new InventoryDispatchService(balanceRepository, reservationRepository, movementRepository, clock);
        product = withId(new Product("N19", "Nước 19L", null, "binh", null, null, new BigDecimal("20000")), 10L);
    }

    @Test
    void dispatchMovesAllReservedQuantityOutOfStock() {
        InventoryBalance soon = balance(100L, "SOON", TODAY.plusDays(5), 10, 3);
        InventoryBalance later = balance(101L, "LATER", TODAY.plusDays(60), 10, 2);
        StockReservation first = reservation(1L, 1L, soon, 3);
        StockReservation second = reservation(2L, 1L, later, 2);
        when(reservationRepository.findByOrderItemIdIn(List.of(1L))).thenReturn(List.of(second, first));
        when(balanceRepository.findForUpdateByBatchId(100L)).thenReturn(Optional.of(soon));
        when(balanceRepository.findForUpdateByBatchId(101L)).thenReturn(Optional.of(later));

        List<DispatchedLine> lines = service.dispatch(ORDER_ID, List.of(1L), USER_ID);

        assertThat(lines).extracting(DispatchedLine::lotCode, DispatchedLine::quantityDispatched)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("SOON", 3), org.assertj.core.groups.Tuple.tuple("LATER", 2));
        assertThat(soon.getOnHand()).isEqualTo(7);
        assertThat(soon.getReserved()).isZero();
        assertThat(later.getOnHand()).isEqualTo(8);
        assertThat(later.getReserved()).isZero();
        assertThat(first.getQuantityDispatched()).isEqualTo(3);
        assertThat(first.getOutstanding()).isZero();

        ArgumentCaptor<InventoryMovement> movements = ArgumentCaptor.forClass(InventoryMovement.class);
        verify(movementRepository, times(2)).save(movements.capture());
        assertThat(movements.getAllValues())
                .allSatisfy(m -> {
                    assertThat(m.getMovementType()).isEqualTo(MovementType.DISPATCH);
                    assertThat(m.getReferenceId()).isEqualTo(ORDER_ID);
                    assertThat(m.getPerformedBy()).isEqualTo(USER_ID);
                })
                .extracting(InventoryMovement::getQuantity).containsExactly(3, 2);
    }

    @Test
    void dispatchRejectsAlreadyDispatchedOrder() {
        InventoryBalance balance = balance(100L, "A", TODAY.plusDays(5), 10, 3);
        StockReservation reservation = reservation(1L, 1L, balance, 3);
        reservation.dispatchAll();
        when(reservationRepository.findByOrderItemIdIn(List.of(1L))).thenReturn(List.of(reservation));

        assertThatThrownBy(() -> service.dispatch(ORDER_ID, List.of(1L), USER_ID))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("đã được xuất kho");
        verify(balanceRepository, never()).findForUpdateByBatchId(any());
        verify(movementRepository, never()).save(any());
    }

    @Test
    void dispatchRejectsOrderItemWithoutReservation() {
        when(reservationRepository.findByOrderItemIdIn(List.of(1L))).thenReturn(List.of());

        assertThatThrownBy(() -> service.dispatch(ORDER_ID, List.of(1L), USER_ID))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("chưa được giữ hàng");
    }

    @Test
    void dispatchRejectsWholeOrderWhenOneLineIsNotReserved() {
        InventoryBalance balance = balance(100L, "A", TODAY.plusDays(5), 10, 3);
        StockReservation reservation = reservation(1L, 1L, balance, 3);
        when(reservationRepository.findByOrderItemIdIn(List.of(1L, 2L))).thenReturn(List.of(reservation));

        assertThatThrownBy(() -> service.dispatch(ORDER_ID, List.of(1L, 2L), USER_ID))
                .isInstanceOf(ConflictException.class);
        // Kiểm tra trước khi động vào tồn kho, nên dòng hợp lệ cũng không bị xuất
        assertThat(reservation.getQuantityDispatched()).isZero();
        assertThat(balance.getOnHand()).isEqualTo(10);
    }

    @Test
    void dispatchRejectsExpiredBatch() {
        InventoryBalance expired = balance(100L, "OLD", TODAY, 10, 3);
        StockReservation reservation = reservation(1L, 1L, expired, 3);
        when(reservationRepository.findByOrderItemIdIn(List.of(1L))).thenReturn(List.of(reservation));

        assertThatThrownBy(() -> service.dispatch(ORDER_ID, List.of(1L), USER_ID))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("hết hạn");
        assertThat(expired.getOnHand()).isEqualTo(10);
        verify(movementRepository, never()).save(any());
    }

    @Test
    void receiveReturnAddsOnlyResellableQuantityBackToStock() {
        InventoryBalance balance = balance(100L, "A", TODAY.plusDays(5), 10, 5);
        StockReservation reservation = reservation(1L, 1L, balance, 5);
        reservation.dispatchAll();
        balance.dispatch(5);
        when(reservationRepository.findByOrderItemIdIn(List.of(1L))).thenReturn(List.of(reservation));
        when(balanceRepository.findForUpdateByBatchId(100L)).thenReturn(Optional.of(balance));

        List<DispatchedLine> lines = service.receiveReturn(
                ORDER_ID, List.of(new ReturnLine(1L, 100L, 4, 1)), "Khách không nhận", USER_ID);

        assertThat(balance.getOnHand()).isEqualTo(9);
        assertThat(reservation.getQuantityDispatched()).isEqualTo(5);
        assertThat(reservation.getQuantityReturned()).isEqualTo(4);
        assertThat(reservation.getQuantityDamaged()).isEqualTo(1);
        assertThat(lines).singleElement().extracting(DispatchedLine::quantityUnreturned).isEqualTo(0);

        ArgumentCaptor<InventoryMovement> movement = ArgumentCaptor.forClass(InventoryMovement.class);
        verify(movementRepository).save(movement.capture());
        assertThat(movement.getValue().getMovementType()).isEqualTo(MovementType.RETURN);
        assertThat(movement.getValue().getQuantity()).isEqualTo(4);
        assertThat(movement.getValue().getReason()).isEqualTo("Khách không nhận");
    }

    @Test
    void receiveReturnWithOnlyDamagedGoodsDoesNotTouchStock() {
        InventoryBalance balance = balance(100L, "A", TODAY.plusDays(5), 10, 2);
        StockReservation reservation = reservation(1L, 1L, balance, 2);
        reservation.dispatchAll();
        when(reservationRepository.findByOrderItemIdIn(List.of(1L))).thenReturn(List.of(reservation));

        service.receiveReturn(ORDER_ID, List.of(new ReturnLine(1L, 100L, 0, 2)), null, USER_ID);

        assertThat(reservation.getQuantityDamaged()).isEqualTo(2);
        verify(balanceRepository, never()).findForUpdateByBatchId(any());
        verify(movementRepository, never()).save(any());
    }

    @Test
    void receiveReturnRejectsMoreThanDispatched() {
        InventoryBalance balance = balance(100L, "A", TODAY.plusDays(5), 10, 2);
        StockReservation reservation = reservation(1L, 1L, balance, 2);
        reservation.dispatchAll();
        when(reservationRepository.findByOrderItemIdIn(List.of(1L))).thenReturn(List.of(reservation));

        assertThatThrownBy(() -> service.receiveReturn(
                ORDER_ID, List.of(new ReturnLine(1L, 100L, 2, 1)), null, USER_ID))
                .isInstanceOf(ConflictException.class);
        assertThat(reservation.getQuantityReturned()).isZero();
    }

    @Test
    void receiveReturnRejectsBatchThatWasNotDispatched() {
        InventoryBalance balance = balance(100L, "A", TODAY.plusDays(5), 10, 2);
        StockReservation reservation = reservation(1L, 1L, balance, 2);
        when(reservationRepository.findByOrderItemIdIn(List.of(1L))).thenReturn(List.of(reservation));

        assertThatThrownBy(() -> service.receiveReturn(
                ORDER_ID, List.of(new ReturnLine(1L, 100L, 1, 0)), null, USER_ID))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("không có hàng đã xuất");
    }

    @Test
    void returnLineRequiresSomeQuantity() {
        assertThatThrownBy(() -> new ReturnLine(1L, 100L, 0, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ReturnLine(1L, 100L, -1, 2)).isInstanceOf(IllegalArgumentException.class);
    }

    private StockReservation reservation(Long id, Long orderItemId, InventoryBalance balance, int quantity) {
        return withId(new StockReservation(orderItemId, balance.getBatch(), quantity), id);
    }

    private InventoryBalance balance(Long batchId, String lot, LocalDate expiresOn, int onHand, int reserved) {
        InventoryBalance balance = new InventoryBalance(withId(new ProductBatch(product, lot, null, expiresOn), batchId));
        balance.receive(onHand);
        if (reserved > 0) {
            balance.reserve(reserved);
        }
        return balance;
    }

    private static <T> T withId(T entity, Long id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }
}
