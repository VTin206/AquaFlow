package com.aquaflow.customer.order.api;

import com.aquaflow.customer.order.api.dto.OrderItemRequest;
import com.aquaflow.customer.order.application.DeliveryPricing;
import com.aquaflow.inventory.domain.Product;
import com.aquaflow.inventory.repository.ProductRepository;
import com.aquaflow.shared.api.NotFoundException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/delivery-quotes")
public class DeliveryQuoteController {
    private final ProductRepository products;
    public DeliveryQuoteController(ProductRepository products) { this.products = products; }

    public record Request(@NotEmpty @Size(max = 100) List<@NotNull @Valid OrderItemRequest> items,
                          @Min(0) @Max(30) int stairFloor) {}

    @PostMapping
    @Transactional(readOnly = true)
    public DeliveryPricing.Quote quote(@Valid @RequestBody Request request) {
        BigDecimal subtotal = BigDecimal.ZERO;
        long units = 0, jugs = 0;
        for (var line : request.items()) {
            Product product = products.findById(line.productId()).filter(Product::isActive)
                    .orElseThrow(() -> new NotFoundException("Active product not found: " + line.productId()));
            subtotal = subtotal.add(product.getSalePrice().multiply(BigDecimal.valueOf(line.quantity())));
            units += line.quantity();
            if (DeliveryPricing.isJug(product.getUnit())) jugs += line.quantity();
        }
        return DeliveryPricing.calculate(subtotal, units, jugs, request.stairFloor());
    }
}
