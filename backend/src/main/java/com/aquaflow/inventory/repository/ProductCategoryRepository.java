package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.ProductCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductCategoryRepository extends JpaRepository<ProductCategory, Long> {
    /** Thứ tự tạo cũng là thứ tự hiện trên bộ lọc. */
    List<ProductCategory> findAllByOrderByIdAsc();

    List<ProductCategory> findByActiveOrderByIdAsc(boolean active);

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
}
