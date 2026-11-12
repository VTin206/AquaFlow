package com.aquaflow.inventory.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** Loại sản phẩm do cửa hàng tự đặt (Tinh khiết, Nước khoáng...), dùng để phân loại và lọc danh mục. */
@Entity
@Table(name = "product_categories")
public class ProductCategory {
    public static final int NAME_MAX_LENGTH = 80;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = NAME_MAX_LENGTH)
    private String name;

    /** Ngừng dùng: không chọn được cho sản phẩm khác, sản phẩm đang thuộc loại này vẫn giữ nguyên. */
    @Column(nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ProductCategory() {
    }

    public ProductCategory(String name) {
        this.name = name;
        this.active = true;
        this.createdAt = Instant.now();
    }

    public void rename(String name) {
        this.name = name;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public boolean isActive() { return active; }
    public Instant getCreatedAt() { return createdAt; }
}
