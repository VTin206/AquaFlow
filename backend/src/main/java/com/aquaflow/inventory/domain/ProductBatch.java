package com.aquaflow.inventory.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "product_batches")
public class ProductBatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "lot_code", nullable = false, length = 100)
    private String lotCode;

    @Column(name = "manufactured_on")
    private LocalDate manufacturedOn;

    @Column(name = "expires_on", nullable = false)
    private LocalDate expiresOn;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ProductBatch() {
    }

    public ProductBatch(Product product, String lotCode, LocalDate manufacturedOn, LocalDate expiresOn) {
        if (manufacturedOn != null && !expiresOn.isAfter(manufacturedOn)) {
            throw new IllegalArgumentException("Hạn sử dụng phải sau ngày sản xuất");
        }
        this.product = product;
        this.lotCode = lotCode;
        this.manufacturedOn = manufacturedOn;
        this.expiresOn = expiresOn;
        this.createdAt = Instant.now();
    }

    /** Lô còn bán được khi hạn sử dụng sau ngày hôm nay. */
    public boolean isSellableOn(LocalDate today) {
        return expiresOn.isAfter(today);
    }

    public Long getId() { return id; }
    public Product getProduct() { return product; }
    public String getLotCode() { return lotCode; }
    public LocalDate getManufacturedOn() { return manufacturedOn; }
    public LocalDate getExpiresOn() { return expiresOn; }
    public Instant getCreatedAt() { return createdAt; }
}
