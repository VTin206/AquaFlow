package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.Product;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {
    boolean existsBySku(String sku);

    @EntityGraph(attributePaths = {"bottleType", "category"})
    List<Product> findAll();

    @EntityGraph(attributePaths = {"bottleType", "category"})
    List<Product> findByActive(Boolean active);

    /** Số kế tiếp cho mã sản phẩm tự sinh (SP00001...). */
    @Query(value = "SELECT nextval('product_sku_seq')", nativeQuery = true)
    long nextSkuNumber();

    /** Số sản phẩm (cả đang bán và đã ngừng) của một loại. */
    long countByCategory_Id(Long categoryId);

    @Query("select p.category.id as categoryId, count(p) as total from Product p where p.category is not null group by p.category.id")
    List<CategoryCount> countPerCategory();

    interface CategoryCount {
        Long getCategoryId();

        long getTotal();
    }
}
