package com.aquaflow.inventory.application;

import com.aquaflow.inventory.api.dto.CreateProductRequest;
import com.aquaflow.inventory.api.dto.UpdateProductRequest;
import com.aquaflow.inventory.api.dto.ProductResponse;
import com.aquaflow.inventory.domain.BottleType;
import com.aquaflow.inventory.domain.Product;
import com.aquaflow.inventory.repository.BottleTypeRepository;
import com.aquaflow.inventory.repository.ProductRepository;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private BottleTypeRepository bottleTypeRepository;
    @Mock private com.aquaflow.workspace.repository.StoreSettingsRepository settings;
    @Mock private com.aquaflow.inventory.repository.ProductCategoryRepository categoryRepository;

    @InjectMocks
    private ProductService productService;

    @Test
    void createSavesProductWithBottleType() {
        BottleType bottleType = new BottleType("Bình 19L", new BigDecimal("50000"));
        when(productRepository.existsBySku("NUOC-19L")).thenReturn(false);
        when(bottleTypeRepository.findById(1L)).thenReturn(Optional.of(bottleType));
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProductResponse response = productService.create(request("NUOC-19L", 1L));

        assertThat(response.sku()).isEqualTo("NUOC-19L");
        assertThat(response.bottleTypeName()).isEqualTo("Bình 19L");
        assertThat(response.active()).isTrue();
    }

    @Test
    void createUsesConfiguredDefaultAndPreservesExplicitZero() {
        when(settings.defaultLowStock()).thenReturn(37);
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));
        assertThat(productService.create(request("DEFAULT", null)).lowStockThreshold()).isEqualTo(37);
        var explicit = new CreateProductRequest("ZERO", "Water", null, "Bottle", null, null, BigDecimal.ONE, null, 0);
        assertThat(productService.create(explicit).lowStockThreshold()).isZero();
        verify(settings).defaultLowStock();
    }

    @Test
    void createAllowsProductWithoutBottleType() {
        when(productRepository.existsBySku("CHAI-500")).thenReturn(false);
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProductResponse response = productService.create(request("CHAI-500", null));

        assertThat(response.bottleTypeId()).isNull();
        assertThat(response.bottleTypeName()).isNull();
        verify(bottleTypeRepository, never()).findById(any());
    }

    @Test
    void createRejectsDuplicateSku() {
        when(productRepository.existsBySku("NUOC-19L")).thenReturn(true);

        assertThatThrownBy(() -> productService.create(request("NUOC-19L", 1L)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("NUOC-19L");
        verify(productRepository, never()).save(any());
    }

    @Test
    void createRejectsMissingBottleType() {
        when(productRepository.existsBySku("NUOC-19L")).thenReturn(false);
        when(bottleTypeRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.create(request("NUOC-19L", 99L)))
                .isInstanceOf(NotFoundException.class);
        verify(productRepository, never()).save(any());
    }

    @Test
    void createRejectsInactiveBottleType() {
        BottleType bottleType = new BottleType("Bình 19L", new BigDecimal("50000"));
        bottleType.deactivate();
        when(productRepository.existsBySku("NUOC-19L")).thenReturn(false);
        when(bottleTypeRepository.findById(1L)).thenReturn(Optional.of(bottleType));

        assertThatThrownBy(() -> productService.create(request("NUOC-19L", 1L)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void findByIdThrowsWhenProductMissing() {
        when(productRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.findById(99L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void deleteDeactivatesProductInsteadOfRemovingIt() {
        Product product = new Product("NUOC-19L", "Nước 19L", "Aqua", "Bình", null, null, new BigDecimal("20000"));
        when(productRepository.findById(5L)).thenReturn(Optional.of(product));

        productService.delete(5L);

        assertThat(product.isActive()).isFalse();
        verify(productRepository, never()).delete(any());
    }

    private CreateProductRequest request(String sku, Long bottleTypeId) {
        return new CreateProductRequest(sku, "Nước 19L", "Aqua", "Bình", null, bottleTypeId, new BigDecimal("20000"), null);
    }

    @Test
    void imageIsSavedAndReturnedOnRead() {
        String image = "data:image/png;base64,aGVsbG8=";
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> {
            Product saved = invocation.getArgument(0);
            when(productRepository.findById(5L)).thenReturn(Optional.of(saved));
            return saved;
        });
        ProductResponse created = productService.create(new CreateProductRequest(
                "PHOTO", "Water", "Aqua", "Bottle", null, null, BigDecimal.TEN, image));
        assertThat(created.image()).isEqualTo(image);
        assertThat(productService.findById(5L).image()).isEqualTo(image);
    }

    @Test
    void updateReplacesImageAndPreservesItForOlderClients() {
        Product product = new Product("PHOTO", "Water", "Aqua", "Bottle", null, null, BigDecimal.TEN);
        product.setImage("/images/old.png");
        when(productRepository.findById(5L)).thenReturn(Optional.of(product));

        assertThat(productService.update(5L, new UpdateProductRequest(
                "Water", "Aqua", "Bottle", null, null, BigDecimal.TEN, "/images/new.png")).image())
                .isEqualTo("/images/new.png");
        assertThat(productService.update(5L, new UpdateProductRequest(
                "Water", "Aqua", "Bottle", null, null, BigDecimal.TEN, null)).image())
                .isEqualTo("/images/new.png");
        assertThat(productService.update(5L, new UpdateProductRequest(
                "Water", "Aqua", "Bottle", null, null, BigDecimal.TEN, "")).image()).isNull();
    }

    @Test
    void lowStockThresholdDefaultsAndOlderClientsKeepIt() {
        Product product = new Product("LOW", "Water", "Aqua", "Bottle", null, null, BigDecimal.TEN);
        when(productRepository.findById(6L)).thenReturn(Optional.of(product));
        assertThat(productService.findById(6L).lowStockThreshold()).isEqualTo(Product.DEFAULT_LOW_STOCK_THRESHOLD);

        assertThat(productService.update(6L, new UpdateProductRequest(
                "Water", "Aqua", "Bottle", null, null, BigDecimal.TEN, null, 25)).lowStockThreshold()).isEqualTo(25);
        assertThat(productService.update(6L, new UpdateProductRequest(
                "Water", "Aqua", "Bottle", null, null, BigDecimal.TEN, null)).lowStockThreshold()).isEqualTo(25);
    }

    @Test
    void blankSkuGetsTheNextGeneratedCodeSkippingCodesTypedByHand() {
        when(productRepository.nextSkuNumber()).thenReturn(7L, 8L);
        when(productRepository.existsBySku("SP00007")).thenReturn(true);
        when(productRepository.existsBySku("SP00008")).thenReturn(false);
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

        assertThat(productService.create(request("  ", null)).sku()).isEqualTo("SP00008");
    }

    @Test
    void typedSkuIsTrimmedAndMustStillBeUnique() {
        when(productRepository.existsBySku("NUOC-19L")).thenReturn(true);

        assertThatThrownBy(() -> productService.create(request(" NUOC-19L ", null))).isInstanceOf(ConflictException.class);
        verify(productRepository, never()).nextSkuNumber();
    }

    @Test
    void categoryIsSetKeptWhenOmittedClearedWithZeroAndRetiredOnesCannotBeNewlyAssigned() {
        Product product = new Product("CAT", "Water", "Aqua", "Bottle", null, null, BigDecimal.TEN);
        when(productRepository.findById(9L)).thenReturn(Optional.of(product));
        when(categoryRepository.findById(2L)).thenReturn(Optional.of(category(2L, "Nước khoáng", true)));
        when(categoryRepository.findById(3L)).thenReturn(Optional.of(category(3L, "Nước có ga", false)));

        assertThat(productService.update(9L, withCategory(2L)).categoryName()).isEqualTo("Nước khoáng");
        assertThat(productService.update(9L, withCategory(null)).categoryId()).isEqualTo(2L);
        assertThatThrownBy(() -> productService.update(9L, withCategory(3L)))
                .isInstanceOf(ConflictException.class).hasMessageContaining("ngừng dùng");
        assertThat(productService.update(9L, withCategory(0L)).categoryId()).isNull();
        assertThatThrownBy(() -> productService.update(9L, withCategory(99L))).isInstanceOf(NotFoundException.class);
    }

    @Test
    void productKeepsItsCategoryAfterTheCategoryIsRetired() {
        Product product = new Product("GA", "Soda", "Aqua", "Lon", null, null, BigDecimal.TEN);
        product.setCategory(category(3L, "Nước có ga", false));
        when(productRepository.findById(10L)).thenReturn(Optional.of(product));

        assertThat(productService.update(10L, withCategory(3L)).categoryName()).isEqualTo("Nước có ga");
        verify(categoryRepository, never()).findById(any());
    }

    private static com.aquaflow.inventory.domain.ProductCategory category(long id, String name, boolean active) {
        var category = new com.aquaflow.inventory.domain.ProductCategory(name);
        org.springframework.test.util.ReflectionTestUtils.setField(category, "id", id);
        category.setActive(active);
        return category;
    }

    private static UpdateProductRequest withCategory(Long categoryId) {
        return new UpdateProductRequest("Water", "Aqua", "Bottle", null, null, BigDecimal.TEN, null, null, categoryId, null);
    }
}
