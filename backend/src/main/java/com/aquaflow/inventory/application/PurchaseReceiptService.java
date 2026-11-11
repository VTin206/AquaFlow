package com.aquaflow.inventory.application;

import com.aquaflow.inventory.api.dto.PurchaseItemRequest;
import com.aquaflow.inventory.api.dto.PurchaseItemResponse;
import com.aquaflow.inventory.api.dto.PurchaseReceiptRequest;
import com.aquaflow.inventory.api.dto.PurchaseReceiptResponse;
import com.aquaflow.inventory.api.dto.PurchaseReceiptPage;
import com.aquaflow.inventory.api.dto.LotSourceResponse;
import com.aquaflow.shared.api.PageRequestParams;
import org.springframework.data.domain.PageRequest;
import com.aquaflow.inventory.domain.InventoryBalance;
import com.aquaflow.inventory.domain.InventoryMovement;
import com.aquaflow.inventory.domain.MovementReferenceType;
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
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
public class PurchaseReceiptService {

    private final PurchaseReceiptRepository receiptRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;
    private final ProductBatchRepository batchRepository;
    private final InventoryBalanceRepository balanceRepository;
    private final InventoryMovementRepository movementRepository;
    private final Clock clock;

    public PurchaseReceiptService(
            PurchaseReceiptRepository receiptRepository,
            SupplierRepository supplierRepository,
            ProductRepository productRepository,
            ProductBatchRepository batchRepository,
            InventoryBalanceRepository balanceRepository,
            InventoryMovementRepository movementRepository,
            Clock clock) {
        this.receiptRepository = receiptRepository;
        this.supplierRepository = supplierRepository;
        this.productRepository = productRepository;
        this.batchRepository = batchRepository;
        this.balanceRepository = balanceRepository;
        this.movementRepository = movementRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PurchaseReceiptPage page(PurchaseReceiptStatus status, PageRequestParams page) {
        var ids = receiptRepository.findPageIds(status, PageRequest.of(page.page(), page.size()));
        Map<Long, PurchaseReceipt> loaded = new HashMap<>();
        if (!ids.isEmpty()) receiptRepository.findWithItemsByIdIn(ids.getContent()).forEach(r -> loaded.put(r.getId(), r));
        Map<PurchaseReceiptStatus, Long> counts = new EnumMap<>(PurchaseReceiptStatus.class);
        for (PurchaseReceiptStatus value : PurchaseReceiptStatus.values()) counts.put(value, 0L);
        receiptRepository.countByStatus().forEach(row -> counts.put(row.getStatus(), row.getTotal()));
        return new PurchaseReceiptPage(
                ids.getContent().stream().map(loaded::get).filter(Objects::nonNull).map(this::toResponse).toList(),
                page.page(), page.size(), ids.getTotalElements(), page.totalPages(ids.getTotalElements()), counts);
    }

    /** Nguồn nhập của từng lô: phiếu đầu tiên, ngày sản xuất, tổng số đạt đã nhập và giá vốn đầu tiên. */
    @Transactional(readOnly = true)
    public List<LotSourceResponse> lotSources() {
        Map<Long, LotSourceResponse> sources = new LinkedHashMap<>();
        for (var line : receiptRepository.findConfirmedLines()) {
            sources.merge(line.getBatchId(),
                    new LotSourceResponse(line.getBatchId(), line.getReceiptId(), line.getReceivedAt(), line.getManufacturedOn(),
                            line.getQuantityAccepted(), line.getUnitCost()),
                    // Dòng đã sắp theo ngày nhận: giữ phiếu đầu tiên, chỉ cộng dồn số lượng.
                    (first, next) -> new LotSourceResponse(first.batchId(), first.receiptId(), first.receivedAt(),
                            first.manufacturedOn(), first.received() + next.received(), first.unitCost()));
        }
        return List.copyOf(sources.values());
    }

    @Transactional(readOnly = true)
    public PurchaseReceiptResponse findById(Long id) {
        return toResponse(receiptRepository.findWithItemsById(id)
                .orElseThrow(() -> notFound(id)));
    }

    @Transactional
    public PurchaseReceiptResponse create(PurchaseReceiptRequest request, Long userId) {
        PurchaseReceipt receipt = new PurchaseReceipt(
                getActiveSupplier(request.supplierId()), request.receivedAt(), userId, request.note());
        receipt.assignReceiver(request.receiverName());
        addItems(receipt, request);
        return toResponse(receiptRepository.save(receipt));
    }

    @Transactional
    public PurchaseReceiptResponse update(Long id, PurchaseReceiptRequest request) {
        PurchaseReceipt receipt = getForUpdate(id);
        receipt.update(getActiveSupplier(request.supplierId()), request.receivedAt(), request.note());
        receipt.assignReceiver(request.receiverName());
        receipt.clearItems();
        addItems(receipt, request);
        return toResponse(receipt);
    }

    /**
     * Xác nhận phiếu: cộng số lượng chấp nhận vào tồn từng lô và ghi lịch sử nhập kho.
     * Số lượng bị loại (thiếu/hỏng) chỉ lưu trên dòng phiếu, không cộng vào tồn có thể bán.
     */
    @Transactional
    public PurchaseReceiptResponse confirm(Long id, Long userId) {
        PurchaseReceipt receipt = getForUpdate(id);
        receipt.confirm(userId);

        for (PurchaseItem item : receipt.getItems()) {
            if (item.getQuantityAccepted() == 0) {
                continue;
            }
            ProductBatch batch = item.getBatch();
            InventoryBalance balance = balanceRepository.findForUpdateByBatchId(batch.getId())
                    .orElseGet(() -> new InventoryBalance(batch));
            balance.receive(item.getQuantityAccepted());
            balanceRepository.save(balance);
            movementRepository.save(new InventoryMovement(
                    batch, MovementType.RECEIVE, item.getQuantityAccepted(),
                    MovementReferenceType.PURCHASE_RECEIPT, receipt.getId(), null, userId));
        }
        return toResponse(receipt);
    }

    @Transactional
    public PurchaseReceiptResponse cancel(Long id) {
        PurchaseReceipt receipt = getForUpdate(id);
        receipt.cancel();
        return toResponse(receipt);
    }

    private void addItems(PurchaseReceipt receipt, PurchaseReceiptRequest request) {
        LocalDate receivedOn = LocalDate.ofInstant(request.receivedAt(), clock.getZone());
        Set<String> seenLots = new HashSet<>();
        for (PurchaseItemRequest itemRequest : request.items()) {
            if (!seenLots.add(itemRequest.productId() + "|" + itemRequest.lotCode())) {
                throw new BadRequestException("Lô " + itemRequest.lotCode() + " bị lặp trong phiếu nhập");
            }
            receipt.addItem(toItem(itemRequest, receivedOn));
        }
    }

    private PurchaseItem toItem(PurchaseItemRequest request, LocalDate receivedOn) {
        if (request.quantityAccepted() > request.quantityReceived()) {
            throw new BadRequestException("Số lượng chấp nhận không được lớn hơn số lượng nhận");
        }
        if (request.manufacturedOn() != null && !request.expiresOn().isAfter(request.manufacturedOn())) {
            throw new BadRequestException("Hạn sử dụng phải sau ngày sản xuất (lô " + request.lotCode() + ")");
        }
        if (request.expiresOn().isBefore(receivedOn)) {
            throw new BadRequestException("Hạn sử dụng không được trước ngày nhập kho (lô " + request.lotCode() + ")");
        }
        Product product = productRepository.findById(request.productId())
                .filter(Product::isActive)
                .orElseThrow(() -> new NotFoundException("Product not found: " + request.productId()));
        return new PurchaseItem(product, findOrCreateBatch(product, request),
                request.quantityReceived(), request.quantityAccepted(), request.unitCost());
    }

    // Mã lô là duy nhất theo sản phẩm: nhập thêm cùng lô thì dùng lại lô cũ, nhưng HSD/NSX phải khớp
    private ProductBatch findOrCreateBatch(Product product, PurchaseItemRequest request) {
        return batchRepository.findByProductIdAndLotCode(product.getId(), request.lotCode())
                .map(existing -> {
                    if (!existing.getExpiresOn().equals(request.expiresOn())
                            || (request.manufacturedOn() != null
                                && !Objects.equals(existing.getManufacturedOn(), request.manufacturedOn()))) {
                        throw new BadRequestException(
                                "Lô " + request.lotCode() + " đã tồn tại với ngày sản xuất/hạn sử dụng khác");
                    }
                    return existing;
                })
                .orElseGet(() -> batchRepository.save(new ProductBatch(
                        product, request.lotCode(), request.manufacturedOn(), request.expiresOn())));
    }

    private Supplier getActiveSupplier(Long supplierId) {
        return supplierRepository.findById(supplierId)
                .filter(Supplier::isActive)
                .orElseThrow(() -> new NotFoundException("Supplier not found: " + supplierId));
    }

    private PurchaseReceipt getForUpdate(Long id) {
        return receiptRepository.findForUpdateById(id).orElseThrow(() -> notFound(id));
    }

    private static NotFoundException notFound(Long id) {
        return new NotFoundException("Purchase receipt not found: " + id);
    }

    private PurchaseReceiptResponse toResponse(PurchaseReceipt receipt) {
        return new PurchaseReceiptResponse(
                receipt.getId(),
                receipt.getSupplier().getId(),
                receipt.getSupplier().getName(),
                receipt.getStatus(),
                receipt.getReceivedAt(),
                receipt.getCreatedBy(),
                receipt.getConfirmedBy(),
                receipt.getConfirmedAt(),
                receipt.getNote(),
                receipt.getItems().stream().map(this::toItemResponse).toList(),
                receipt.getReceiverName());
    }

    private PurchaseItemResponse toItemResponse(PurchaseItem item) {
        ProductBatch batch = item.getBatch();
        return new PurchaseItemResponse(
                item.getId(),
                item.getProduct().getId(),
                item.getProduct().getName(),
                batch.getId(),
                batch.getLotCode(),
                batch.getManufacturedOn(),
                batch.getExpiresOn(),
                item.getQuantityReceived(),
                item.getQuantityAccepted(),
                item.getQuantityRejected(),
                item.getUnitCost());
    }
}
