package com.aquaflow.inventory.application;

import com.aquaflow.inventory.api.dto.BatchStockResponse;
import com.aquaflow.inventory.api.dto.ProductStockResponse;
import com.aquaflow.inventory.domain.InventoryBalance;
import com.aquaflow.inventory.domain.Product;
import com.aquaflow.inventory.domain.ProductBatch;
import com.aquaflow.inventory.repository.InventoryBalanceRepository;
import com.aquaflow.inventory.repository.ProductRepository;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class StockService {

    private final InventoryBalanceRepository balanceRepository;
    private final ProductRepository productRepository;
    private final Clock clock;

    public StockService(InventoryBalanceRepository balanceRepository, ProductRepository productRepository, Clock clock) {
        this.balanceRepository = balanceRepository;
        this.productRepository = productRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ProductStockResponse> findAll() {
        Map<Long, List<InventoryBalance>> byProduct = new LinkedHashMap<>();
        for (InventoryBalance balance : balanceRepository.findAllWithBatch()) {
            byProduct.computeIfAbsent(balance.getBatch().getProduct().getId(), id -> new ArrayList<>()).add(balance);
        }
        LocalDate today = LocalDate.now(clock);
        return byProduct.values().stream()
                .map(balances -> toResponse(balances.get(0).getBatch().getProduct(), balances, today))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductStockResponse findByProduct(Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new NotFoundException("Product not found: " + productId));
        return toResponse(product, balanceRepository.findByProductWithBatch(productId), LocalDate.now(clock));
    }

    private ProductStockResponse toResponse(Product product, List<InventoryBalance> balances, LocalDate today) {
        List<BatchStockResponse> batches = balances.stream().map(b -> toBatchResponse(b, today)).toList();
        int onHand = batches.stream().mapToInt(BatchStockResponse::onHand).sum();
        int reserved = batches.stream().mapToInt(BatchStockResponse::reserved).sum();
        int available = batches.stream().mapToInt(BatchStockResponse::available).sum();
        int expiredOnHand = batches.stream().filter(BatchStockResponse::expired).mapToInt(BatchStockResponse::onHand).sum();
        return new ProductStockResponse(product.getId(), product.getSku(), product.getName(),
                onHand, reserved, available, expiredOnHand, batches);
    }

    private BatchStockResponse toBatchResponse(InventoryBalance balance, LocalDate today) {
        ProductBatch batch = balance.getBatch();
        boolean expired = !batch.isSellableOn(today);
        return new BatchStockResponse(batch.getId(), batch.getLotCode(), batch.getExpiresOn(), expired,
                balance.getOnHand(), balance.getReserved(), expired ? 0 : balance.getAvailable());
    }
}
