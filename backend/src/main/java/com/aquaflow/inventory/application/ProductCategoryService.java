package com.aquaflow.inventory.application;

import com.aquaflow.inventory.api.dto.ProductCategoryRequest;
import com.aquaflow.inventory.api.dto.ProductCategoryResponse;
import com.aquaflow.inventory.domain.ProductCategory;
import com.aquaflow.inventory.repository.ProductCategoryRepository;
import com.aquaflow.inventory.repository.ProductRepository;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Loại sản phẩm do cửa hàng tự quản lý: thêm, đổi tên, ngừng dùng / dùng lại, xóa khi chưa có sản phẩm nào. */
@Service
public class ProductCategoryService {
    private final ProductCategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    public ProductCategoryService(ProductCategoryRepository categoryRepository, ProductRepository productRepository) {
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
    }

    /** {@code active} null: tất cả loại. Xếp theo thứ tự tạo. */
    @Transactional(readOnly = true)
    public List<ProductCategoryResponse> findAll(Boolean active) {
        List<ProductCategory> categories = active == null
                ? categoryRepository.findAllByOrderByIdAsc()
                : categoryRepository.findByActiveOrderByIdAsc(active);
        Map<Long, Long> counts = productRepository.countPerCategory().stream()
                .collect(Collectors.toMap(ProductRepository.CategoryCount::getCategoryId, ProductRepository.CategoryCount::getTotal));
        return categories.stream().map(category -> toResponse(category, counts.getOrDefault(category.getId(), 0L))).toList();
    }

    @Transactional
    public ProductCategoryResponse create(ProductCategoryRequest request) {
        String name = normalizeName(request.name());
        if (categoryRepository.existsByNameIgnoreCase(name)) {
            throw duplicate(name);
        }
        // Ghi ngay để chỉ mục tên không phân biệt hoa thường báo trùng (409) trong request này nếu hai người cùng thêm.
        return toResponse(categoryRepository.saveAndFlush(new ProductCategory(name)), 0);
    }

    @Transactional
    public ProductCategoryResponse update(Long id, ProductCategoryRequest request) {
        ProductCategory category = getCategory(id);
        String name = normalizeName(request.name());
        if (categoryRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw duplicate(name);
        }
        category.rename(name);
        if (request.active() != null) {
            category.setActive(request.active());
        }
        categoryRepository.flush();
        return toResponse(category, productRepository.countByCategory_Id(id));
    }

    /** Chỉ xóa loại chưa có sản phẩm nào; còn sản phẩm thì đổi loại cho chúng trước hoặc ngừng dùng loại này. */
    @Transactional
    public void delete(Long id) {
        ProductCategory category = getCategory(id);
        long products = productRepository.countByCategory_Id(id);
        if (products > 0) {
            throw new ConflictException("Loại " + category.getName() + " còn " + products
                    + " sản phẩm. Đổi loại cho các sản phẩm đó hoặc chọn Ngừng dùng.");
        }
        categoryRepository.delete(category);
    }

    /** Bỏ khoảng trắng thừa để "Nước  khoáng " và "Nước khoáng" không thành hai loại. */
    static String normalizeName(String name) {
        return name.trim().replaceAll("\\s+", " ");
    }

    private ProductCategory getCategory(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Product category not found: " + id));
    }

    private static ConflictException duplicate(String name) {
        return new ConflictException("Đã có loại sản phẩm " + name + ".");
    }

    private static ProductCategoryResponse toResponse(ProductCategory category, long productCount) {
        return new ProductCategoryResponse(category.getId(), category.getName(), category.isActive(), productCount);
    }
}
