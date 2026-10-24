package com.aquaflow.inventory.application;

import com.aquaflow.inventory.api.dto.PurchaseItemRequest;
import com.aquaflow.inventory.api.dto.PurchaseReceiptRequest;
import com.aquaflow.inventory.api.dto.PurchaseReceiptResponse;
import com.aquaflow.inventory.domain.InventoryBalance;
import com.aquaflow.inventory.domain.InventoryMovement;
import com.aquaflow.inventory.domain.MovementType;
import com.aquaflow.inventory.domain.Product;
import com.aquaflow.inventory.domain.ProductBatch;
import com.aquaflow.inventory.domain.PurchaseItem;
import com.aquaflow.inventory.domain.PurchaseReceipt;
import com.aquaflow.inventory.domain.PurchaseReceiptStatus;
import com.aquaflow.inventory.domain.Supplier;
import com.aquaflow.inventory.repository.InventoryBalanceRepository;
import com.aquaflow.inventory.repository.InventoryMovementRepository;
import com.aquaflow.inventory.repository.ProductBatchRepository;
import com.aquaflow.inventory.repository.ProductRepository;
import com.aquaflow.inventory.repository.PurchaseReceiptRepository;
import com.aquaflow.inventory.repository.SupplierRepository;
import com.aquaflow.shared.api.BadRequestException;
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
class PurchaseReceiptServiceTest {

    private static final Instant RECEIVED_AT = Instant.parse("2026-10-24T03:00:00Z");
    private static final LocalDate EXPIRES_ON = LocalDate.of(2027, 1, 1);

    @Mock private PurchaseReceiptRepository receiptRepository;
    @Mock private SupplierRepository supplierRepository;
    @Mock private ProductRepository productRepository;
    @Mock private ProductBatchRepository batchRepository;
    @Mock private InventoryBalanceRepository balanceRepository;
    @Mock private InventoryMovementRepository movementRepository;

    private PurchaseReceiptService service;
    private Supplier supplier;
    private Product product;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(RECEIVED_AT, ZoneId.of("Asia/Ho_Chi_Minh"));
        service = new PurchaseReceiptService(receiptRepository, supplierRepository, productRepository,
                batchRepository, balanceRepository, movementRepository, clock);
        supplier = withId(new Supplier("NCC A", "0901234567", "HCM"), 1L);
        product = withId(new Product("NUOC-19L", "Nước 19L", null, "binh", null, null, new BigDecimal("20000")), 10L);
    }

    @Test
    void createBuildsDraftAndNewBatch() {
        stubSupplierAndProduct();
        when(batchRepository.findByProductIdAndLotCode(10L, "L1")).thenReturn(Optional.empty());
        when(batchRepository.save(any(ProductBatch.class))).thenAnswer(inv -> withId(inv.getArgument(0), 100L));
        when(receiptRepository.save(any(PurchaseReceipt.class))).thenAnswer(inv -> inv.getArgument(0));

        PurchaseReceiptResponse response = service.create(request(item("L1", EXPIRES_ON, 10, 8)), 5L);

        assertThat(response.status()).isEqualTo(PurchaseReceiptStatus.DRAFT);
        assertThat(response.createdBy()).isEqualTo(5L);
        assertThat(response.items()).singleElement().satisfies(i -> {
            assertThat(i.batchId()).isEqualTo(100L);
            assertThat(i.quantityRejected()).isEqualTo(2);
        });
    }

    @Test
    void createRejectsExpiryBeforeReceivedDate() {
        when(supplierRepository.findById(1L)).thenReturn(Optional.of(supplier));

        assertThatThrownBy(() -> service.create(request(item("L1", LocalDate.of(2026, 10, 23), 10, 10)), 5L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("ngày nhập kho");
        verify(receiptRepository, never()).save(any());
    }

    @Test
    void createRejectsAcceptedGreaterThanReceived() {
        when(supplierRepository.findById(1L)).thenReturn(Optional.of(supplier));

        assertThatThrownBy(() -> service.create(request(item("L1", EXPIRES_ON, 5, 6)), 5L))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void createRejectsDuplicateLotInSameReceipt() {
        stubSupplierAndProduct();
        when(batchRepository.findByProductIdAndLotCode(10L, "L1")).thenReturn(Optional.empty());
        when(batchRepository.save(any(ProductBatch.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThatThrownBy(() -> service.create(
                request(item("L1", EXPIRES_ON, 5, 5), item("L1", EXPIRES_ON, 3, 3)), 5L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("bị lặp");
    }

    @Test
    void createRejectsExistingLotWithDifferentExpiry() {
        stubSupplierAndProduct();
        ProductBatch existing = new ProductBatch(product, "L1", null, LocalDate.of(2027, 6, 1));
        when(batchRepository.findByProductIdAndLotCode(10L, "L1")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.create(request(item("L1", EXPIRES_ON, 5, 5)), 5L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("đã tồn tại");
    }

    @Test
    void confirmAddsOnlyAcceptedQuantityAndRecordsMovement() {
        ProductBatch batchA = withId(new ProductBatch(product, "A", null, EXPIRES_ON), 100L);
        ProductBatch batchB = withId(new ProductBatch(product, "B", null, EXPIRES_ON), 101L);
        PurchaseReceipt receipt = withId(new PurchaseReceipt(supplier, RECEIVED_AT, 5L, null), 7L);
        receipt.addItem(new PurchaseItem(product, batchA, 10, 8, BigDecimal.TEN));
        receipt.addItem(new PurchaseItem(product, batchB, 4, 0, BigDecimal.TEN));
        InventoryBalance existingBalance = new InventoryBalance(batchA);
        existingBalance.receive(5);
        when(receiptRepository.findForUpdateById(7L)).thenReturn(Optional.of(receipt));
        when(balanceRepository.findForUpdateByBatchId(100L)).thenReturn(Optional.of(existingBalance));

        PurchaseReceiptResponse response = service.confirm(7L, 9L);

        assertThat(response.status()).isEqualTo(PurchaseReceiptStatus.CONFIRMED);
        assertThat(response.confirmedBy()).isEqualTo(9L);
        assertThat(existingBalance.getOnHand()).isEqualTo(13);
        verify(balanceRepository, never()).findForUpdateByBatchId(101L);
        ArgumentCaptor<InventoryMovement> movement = ArgumentCaptor.forClass(InventoryMovement.class);
        verify(movementRepository, times(1)).save(movement.capture());
        assertThat(movement.getValue().getMovementType()).isEqualTo(MovementType.RECEIVE);
        assertThat(movement.getValue().getQuantity()).isEqualTo(8);
        assertThat(movement.getValue().getReferenceId()).isEqualTo(7L);
    }

    @Test
    void confirmRejectsReceiptThatIsNotDraft() {
        PurchaseReceipt receipt = withId(new PurchaseReceipt(supplier, RECEIVED_AT, 5L, null), 7L);
        receipt.cancel();
        when(receiptRepository.findForUpdateById(7L)).thenReturn(Optional.of(receipt));

        assertThatThrownBy(() -> service.confirm(7L, 9L)).isInstanceOf(ConflictException.class);
        verify(balanceRepository, never()).save(any());
    }

    private void stubSupplierAndProduct() {
        when(supplierRepository.findById(1L)).thenReturn(Optional.of(supplier));
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));
    }

    private static PurchaseReceiptRequest request(PurchaseItemRequest... items) {
        return new PurchaseReceiptRequest(1L, RECEIVED_AT, null, List.of(items));
    }

    private static PurchaseItemRequest item(String lot, LocalDate expiresOn, int received, int accepted) {
        return new PurchaseItemRequest(10L, lot, null, expiresOn, received, accepted, new BigDecimal("15000"));
    }

    private static <T> T withId(T entity, Long id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }
}
