package com.aquaflow.delivery.application;

import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderChannel;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.domain.PaymentStatus;
import com.aquaflow.delivery.api.dto.DeliveryAttemptCreateRequest;
import com.aquaflow.delivery.api.dto.DeliveryAttemptResponse;
import com.aquaflow.delivery.domain.DeliveryAttempt;
import com.aquaflow.delivery.domain.DeliveryAttemptOutcome;
import com.aquaflow.delivery.domain.DeliveryLoadItem;
import com.aquaflow.delivery.repository.DeliveryAttemptRepository;
import com.aquaflow.delivery.repository.DeliveryLoadItemRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryAttemptServiceTest {

    @Mock
    private DeliveryAttemptRepository deliveryAttemptRepository;

    @Mock
    private DeliveryLoadItemRepository deliveryLoadItemRepository;

    @Mock
    private OrderService orderService;

    @InjectMocks
    private DeliveryAttemptService deliveryAttemptService;

    @Test
    void recordsFailedAttemptWithoutChangingOrderOrLoadItems() {

        when(deliveryAttemptRepository.existsByAssignmentId(10L))
                .thenReturn(false);

        when(deliveryAttemptRepository.saveAndFlush(
                any(DeliveryAttempt.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        DeliveryAttemptCreateRequest request =
                new DeliveryAttemptCreateRequest(
                        DeliveryAttemptOutcome.FAILED,
                        "Nguyen Van An",
                        "Khach hang khong co nha",
                        "Da goi dien hai lan");

        DeliveryAttemptResponse response =
                deliveryAttemptService
                        .recordAttemptAfterAssignmentValidation(
                                10L,
                                100L,
                                request);

        assertThat(response.assignmentId()).isEqualTo(10L);
        assertThat(response.attemptNo()).isEqualTo(1);
        assertThat(response.outcome())
                .isEqualTo(DeliveryAttemptOutcome.FAILED);
        assertThat(response.failureReason())
                .isEqualTo("Khach hang khong co nha");

        verifyNoInteractions(
                orderService,
                deliveryLoadItemRepository);
    }

    @Test
    void recordsSuccessfulAttemptAndMarksAllLoadItemsAsDelivered() {

        DeliveryLoadItem firstItem =
                new DeliveryLoadItem(10L, 200L, 300L, 5);

        DeliveryLoadItem secondItem =
                new DeliveryLoadItem(10L, 201L, 301L, 3);

        when(deliveryAttemptRepository.existsByAssignmentId(10L))
                .thenReturn(false);

        when(deliveryLoadItemRepository
                .findAllByAssignmentIdOrderByOrderItemIdAscBatchIdAsc(10L))
                .thenReturn(List.of(firstItem, secondItem));

        when(orderService.markDeliveredFromDeliveryWorkflow(100L))
                .thenReturn(Optional.of(
                        sampleOrder(OrderStatus.DELIVERED)));

        when(deliveryAttemptRepository.saveAndFlush(
                any(DeliveryAttempt.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        DeliveryAttemptCreateRequest request =
                new DeliveryAttemptCreateRequest(
                        DeliveryAttemptOutcome.SUCCESS,
                        "Nguyen Van An",
                        null,
                        "Giao hang thanh cong");

        DeliveryAttemptResponse response =
                deliveryAttemptService
                        .recordAttemptAfterAssignmentValidation(
                                10L,
                                100L,
                                request);

        assertThat(response.outcome())
                .isEqualTo(DeliveryAttemptOutcome.SUCCESS);

        assertThat(firstItem.getQuantityDelivered()).isEqualTo(5);
        assertThat(secondItem.getQuantityDelivered()).isEqualTo(3);

        assertThat(firstItem.getRemainingQuantity()).isZero();
        assertThat(secondItem.getRemainingQuantity()).isZero();

        verify(orderService)
                .markDeliveredFromDeliveryWorkflow(100L);

        verify(deliveryLoadItemRepository)
                .saveAll(List.of(firstItem, secondItem));
    }

    @Test
    void rejectsAttemptWhenAssignmentAlreadyHasAnAttempt() {

        when(deliveryAttemptRepository.existsByAssignmentId(10L))
                .thenReturn(true);

        DeliveryAttemptCreateRequest request =
                new DeliveryAttemptCreateRequest(
                        DeliveryAttemptOutcome.FAILED,
                        "Nguyen Van An",
                        "Test",
                        null);

        assertThatThrownBy(() ->
                deliveryAttemptService
                        .recordAttemptAfterAssignmentValidation(
                                10L,
                                100L,
                                request))
                .isInstanceOf(ConflictException.class)
                .hasMessage(
                        "A delivery attempt has already been recorded "
                                + "for this assignment");

        verify(deliveryAttemptRepository, never())
                .saveAndFlush(any(DeliveryAttempt.class));

        verifyNoInteractions(
                orderService,
                deliveryLoadItemRepository);
    }

    @Test
    void rejectsSuccessfulAttemptWhenNoLoadItemsExist() {

        when(deliveryAttemptRepository.existsByAssignmentId(10L))
                .thenReturn(false);

        when(deliveryLoadItemRepository
                .findAllByAssignmentIdOrderByOrderItemIdAscBatchIdAsc(10L))
                .thenReturn(List.of());

        DeliveryAttemptCreateRequest request =
                new DeliveryAttemptCreateRequest(
                        DeliveryAttemptOutcome.SUCCESS,
                        "Nguyen Van An",
                        null,
                        "Giao hang thanh cong");

        assertThatThrownBy(() ->
                deliveryAttemptService
                        .recordAttemptAfterAssignmentValidation(
                                10L,
                                100L,
                                request))
                .isInstanceOf(ConflictException.class)
                .hasMessage(
                        "Cannot complete delivery because no dispatched "
                                + "load items were found");

        verifyNoInteractions(orderService);

        verify(deliveryAttemptRepository, never())
                .saveAndFlush(any(DeliveryAttempt.class));
    }

    @Test
    void rejectsSuccessfulAttemptWhenOrderDoesNotExist() {

        DeliveryLoadItem item =
                new DeliveryLoadItem(10L, 200L, 300L, 5);

        when(deliveryAttemptRepository.existsByAssignmentId(10L))
                .thenReturn(false);

        when(deliveryLoadItemRepository
                .findAllByAssignmentIdOrderByOrderItemIdAscBatchIdAsc(10L))
                .thenReturn(List.of(item));

        when(orderService.markDeliveredFromDeliveryWorkflow(100L))
                .thenReturn(Optional.empty());

        DeliveryAttemptCreateRequest request =
                new DeliveryAttemptCreateRequest(
                        DeliveryAttemptOutcome.SUCCESS,
                        "Nguyen Van An",
                        null,
                        "Giao hang thanh cong");

        assertThatThrownBy(() ->
                deliveryAttemptService
                        .recordAttemptAfterAssignmentValidation(
                                10L,
                                100L,
                                request))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Order not found: 100");

        assertThat(item.getQuantityDelivered()).isZero();

        verify(deliveryLoadItemRepository, never())
                .saveAll(any());

        verify(deliveryAttemptRepository, never())
                .saveAndFlush(any(DeliveryAttempt.class));
    }

    @Test
    void rejectsFailedAttemptWithoutFailureReason() {

        DeliveryAttemptCreateRequest request =
                new DeliveryAttemptCreateRequest(
                        DeliveryAttemptOutcome.FAILED,
                        "Nguyen Van An",
                        "   ",
                        null);

        assertThatThrownBy(() ->
                deliveryAttemptService
                        .recordAttemptAfterAssignmentValidation(
                                10L,
                                100L,
                                request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage(
                        "Failure reason is required for failed delivery attempts");

        verifyNoInteractions(
                deliveryAttemptRepository,
                deliveryLoadItemRepository,
                orderService);
    }

    @Test
    void rejectsSuccessfulAttemptWithFailureReason() {

        DeliveryAttemptCreateRequest request =
                new DeliveryAttemptCreateRequest(
                        DeliveryAttemptOutcome.SUCCESS,
                        "Nguyen Van An",
                        "Khach khong co nha",
                        null);

        assertThatThrownBy(() ->
                deliveryAttemptService
                        .recordAttemptAfterAssignmentValidation(
                                10L,
                                100L,
                                request))
                .isInstanceOf(BadRequestException.class);

        verifyNoInteractions(
                deliveryAttemptRepository,
                deliveryLoadItemRepository,
                orderService);
    }

    @Test
    void rejectsInvalidAssignmentId() {

        DeliveryAttemptCreateRequest request =
                new DeliveryAttemptCreateRequest(
                        DeliveryAttemptOutcome.FAILED,
                        "Nguyen Van An",
                        "Khach khong co nha",
                        null);

        assertThatThrownBy(() ->
                deliveryAttemptService
                        .recordAttemptAfterAssignmentValidation(
                                0L,
                                100L,
                                request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Assignment ID must be positive");

        verifyNoInteractions(
                deliveryAttemptRepository,
                deliveryLoadItemRepository,
                orderService);
    }

    @Test
    void returnsAllAttemptsInAscendingAttemptNumberOrder() {

        DeliveryAttempt firstAttempt = new DeliveryAttempt(
                10L,
                1,
                DeliveryAttemptOutcome.FAILED,
                "Nguyen Van An",
                OffsetDateTime.parse("2026-11-02T10:00:00+07:00"),
                "Khach khong co nha",
                null);

        when(deliveryAttemptRepository
                .findAllByAssignmentIdOrderByAttemptNoAsc(10L))
                .thenReturn(List.of(firstAttempt));

        List<DeliveryAttemptResponse> responses =
                deliveryAttemptService.findAllByAssignmentId(10L);

        assertThat(responses).hasSize(1);

        assertThat(responses)
                .extracting(DeliveryAttemptResponse::attemptNo)
                .containsExactly(1);

        assertThat(responses)
                .extracting(DeliveryAttemptResponse::outcome)
                .containsExactly(DeliveryAttemptOutcome.FAILED);
    }

    @Test
    void rejectsInvalidAssignmentIdWhenFindingHistory() {

        assertThatThrownBy(() ->
                deliveryAttemptService.findAllByAssignmentId(0L))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Assignment ID must be positive");

        verifyNoInteractions(
                deliveryAttemptRepository,
                deliveryLoadItemRepository,
                orderService);
    }

    private OrderResponse sampleOrder(OrderStatus status) {

        return new OrderResponse(
                100L,
                "AF-TEST-100",
                5L,
                7L,
                OrderChannel.WEB,
                FulfillmentType.DELIVERY,
                status,
                PaymentStatus.UNPAID,
                "Nguyen Van An",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5",
                null,
                new BigDecimal("100.00"),
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                new BigDecimal("100.00"),
                OffsetDateTime.now(),
                null,
                null,
                null,
                List.of());
    }

    @Test
    void incrementsAttemptNumberAcrossRedeliveryAssignmentsOfSameOrder() {

        when(deliveryAttemptRepository.existsByAssignmentId(11L))
                .thenReturn(false);

        when(deliveryAttemptRepository.findMaxAttemptNoByOrderId(100L))
                .thenReturn(1);

        when(deliveryAttemptRepository.saveAndFlush(
                any(DeliveryAttempt.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        DeliveryAttemptResponse response =
                deliveryAttemptService.recordAttemptAfterAssignmentValidation(
                        11L,
                        100L,
                        new DeliveryAttemptCreateRequest(
                                DeliveryAttemptOutcome.FAILED,
                                "Nguyen Van An",
                                "Recipient unavailable",
                                null));

        assertThat(response.attemptNo()).isEqualTo(2);

        verify(deliveryAttemptRepository)
                .findMaxAttemptNoByOrderId(100L);
    }
}
