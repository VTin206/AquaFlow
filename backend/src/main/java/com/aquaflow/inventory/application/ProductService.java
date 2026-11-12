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
import com.aquaflow.inventory.domain.ProductCategory;
import com.aquaflow.inventory.repository.ProductCategoryRepository;

@Service
public class ProductService {
    /** Số lần thử lấy mã tự sinh kế tiếp khi trùng mã nhân viên đã nhập tay. */
    private static final int SKU_ATTEMPTS = 1000;

    private final ProductRepository productRepository;
    private final BottleTypeRepository bottleTypeRepository;
    private final com.aquaflow.workspace.repository.StoreSettingsRepository settings;
    private final ProductCategoryRepository categoryRepository;

    public ProductService(ProductRepository productRepository, BottleTypeRepository bottleTypeRepository,
                          com.aquaflow.workspace.repository.StoreSettingsRepository settings,
                          ProductCategoryRepository categoryRepository) {
        this.productRepository = productRepository;
        this.bottleTypeRepository = bottleTypeRepository;
        this.settings = settings;
        this.categoryRepository = categoryRepository;
    }

    @Transactional
    public ProductResponse create(CreateProductRequest request) {
        String sku;
        if (request.sku() == null || request.sku().isBlank()) {
            sku = generateSku();
        } else {
            sku = request.sku().trim();
            if (productRepository.existsBySku(sku)) {
                throw new ConflictException("SKU already exists: " + sku);
            }
        }
        BottleType bottleType = findBottleType(request.bottleTypeId());
        Product product = new Product(
                sku, request.name(), request.brand(), request.unit(),
                request.unitsPerCase(), bottleType, request.salePrice());
        product.setImage(request.image());
        product.setLowStockThreshold(request.lowStockThreshold()!=null?request.lowStockThreshold():settings.defaultLowStock());
        product.setCategory(resolveCategory(request.categoryId(), null));
        product.updateVolume(request.volumeMl());
        return toResponse(productRepository.save(product));
    }

    /** Mã SP00001, SP00002... theo sequence; bỏ qua số trùng với mã đã nhập tay. */
    private String generateSku() {
        for (int attempt = 0; attempt < SKU_ATTEMPTS; attempt++) {
            String sku = String.format("SP%05d", productRepository.nextSkuNumber());
            if (!productRepository.existsBySku(sku)) {
                return sku;
            }
        }
        throw new ConflictException("Không tạo được mã sản phẩm tự động. Hãy nhập mã sản phẩm.");
    }

    /**
     * null giữ nguyên loại hiện tại, 0 bỏ phân loại. Loại đã ngừng dùng chỉ được giữ trên sản phẩm đang thuộc loại đó,
     * không gán mới được.
     */
    private ProductCategory resolveCategory(Long categoryId, ProductCategory current) {
        if (categoryId == null) {
            return current;
        }
        if (categoryId == 0) {
            return null;
        }
        if (current != null && categoryId.equals(current.getId())) {
            return current;
        }
        ProductCategory category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Product category not found: " + categoryId));
        if (!category.isActive()) {
            throw new ConflictException("Loại sản phẩm " + category.getName()
                    + " đã ngừng dùng. Chọn loại khác hoặc dùng lại loại này.");
        }
        return category;
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
        ProductCategory category = product.getCategory();
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
                category == null ? null : category.getId(),
                category == null ? null : category.getName(),
                product.getVolumeMl());
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
        product.setCategory(resolveCategory(request.categoryId(), product.getCategory()));
        product.updateVolume(request.volumeMl());
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
