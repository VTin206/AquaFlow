package com.aquaflow.inventory.application;

import com.aquaflow.inventory.repository.ProductRepository;
import com.aquaflow.inventory.repository.BottleTypeRepository;

import com.aquaflow.inventory.api.dto.ProductResponse;
import com.aquaflow.inventory.api.dto.CreateProductRequest;
import com.aquaflow.inventory.api.dto.UpdateProductRequest;
import java.util.List;
import com.aquaflow.shared.api.NotFoundException;
import com.aquaflow.shared.api.ConflictException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.aquaflow.inventory.domain.Product;
import com.aquaflow.inventory.domain.BottleType;

@Service
public class ProductService {
    private final ProductRepository productRepository;
    private final BottleTypeRepository bottleTypeRepository;
    private final com.aquaflow.workspace.repository.StoreSettingsRepository settings;

    public ProductService(ProductRepository productRepository, BottleTypeRepository bottleTypeRepository,
                          com.aquaflow.workspace.repository.StoreSettingsRepository settings) {
        this.productRepository = productRepository;
        this.bottleTypeRepository = bottleTypeRepository;
        this.settings = settings;
    }

    @Transactional
    public ProductResponse create(CreateProductRequest request) {
        if (productRepository.existsBySku(request.sku())) {
            throw new ConflictException("SKU already exists: " + request.sku());
        }
        BottleType bottleType = findBottleType(request.bottleTypeId());
        Product product = new Product(
                request.sku(), request.name(), request.brand(), request.unit(),
                request.unitsPerCase(), bottleType, request.salePrice());
        product.setImage(request.image());
        product.setLowStockThreshold(request.lowStockThreshold()!=null?request.lowStockThreshold():settings.defaultLowStock());
        product.updateCatalogDetails(request.waterType(), request.volumeMl());
        return toResponse(productRepository.save(product));
    }

    // bottleTypeId là null → sản phẩm không có vỏ, hợp lệ
    // bottleTypeId có giá trị nhưng không tồn tại hoặc đã ngừng dùng → 404
    private BottleType findBottleType(Long bottleTypeId) {
        if (bottleTypeId == null) {
            return null;
        }
        return bottleTypeRepository.findById(bottleTypeId)
                .filter(BottleType::isActive)
                .orElseThrow(() -> new NotFoundException("Bottle type not found: " + bottleTypeId));
    }

    private ProductResponse toResponse(Product product) {
        BottleType bottleType = product.getBottleType();
        return new ProductResponse(
                product.getId(),
                product.getSku(),
                product.getName(),
                product.getBrand(),
                product.getUnit(),
                product.getUnitsPerCase(),
                bottleType == null ? null : bottleType.getId(),
                bottleType == null ? null : bottleType.getName(),
                product.getSalePrice(),
                product.isActive(),
                product.getCreatedAt(), product.getImage(), product.getLowStockThreshold(),
                product.getWaterType(), product.getVolumeMl());
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> findAll(Boolean active) {
        List<Product> products = (active == null)
                ? productRepository.findAll()
                : productRepository.findByActive(active);
        return products.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ProductResponse findById(Long id) {
        return toResponse(getProduct(id));
    }

    @Transactional
    public ProductResponse update(Long id, UpdateProductRequest request) {
        Product product = getProduct(id);
        product.update(
                request.name(), request.brand(), request.unit(),
                request.unitsPerCase(), findBottleType(request.bottleTypeId()), request.salePrice());
        // Older clients may omit image; preserve the existing photo in that case.
        if (request.image() != null) product.setImage(request.image().isBlank() ? null : request.image());
        if (request.lowStockThreshold() != null) product.setLowStockThreshold(request.lowStockThreshold());
        product.updateCatalogDetails(request.waterType(), request.volumeMl());
        return toResponse(product);
    }

    @Transactional
    public void delete(Long id) {
        getProduct(id).deactivate();
    }

    /** Bán lại sản phẩm đã ngừng. Loại vỏ đi kèm phải còn lưu hành, nếu không đơn mới sẽ không tính được cọc vỏ. */
    @Transactional
    public ProductResponse reactivate(Long id) {
        Product product = getProduct(id);
        BottleType bottleType = product.getBottleType();
        if (!product.isActive() && bottleType != null && !bottleType.isActive()) {
            throw new ConflictException("Loại vỏ " + bottleType.getName() + " đã ngừng lưu hành. Lưu hành lại loại vỏ hoặc đổi loại vỏ trước khi bán lại.");
        }
        product.activate();
        return toResponse(product);
    }

    private Product getProduct(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Product not found: " + id));
    }
}
