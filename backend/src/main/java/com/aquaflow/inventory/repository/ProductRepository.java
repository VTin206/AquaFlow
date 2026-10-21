package com.aquaflow.inventory.repository;

import com.aquaflow.inventory.domain.Product;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {
    boolean existsBySku(String sku);

    @EntityGraph(attributePaths = "bottleType")
    List<Product> findAll();

    @EntityGraph(attributePaths = "bottleType")
    List<Product> findByActive(Boolean active);
}
