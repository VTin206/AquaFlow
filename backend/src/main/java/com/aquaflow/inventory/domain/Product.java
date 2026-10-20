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

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "products")
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64, unique = true)
    private String sku;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 150)
    private String brand;

    @Column(nullable = false, length = 40)
    private String unit;

    @Column(name = "units_per_case")
    private Integer unitsPerCase;

    @ManyToOne(optional = true, fetch = FetchType.LAZY)
    @JoinColumn(name = "bottle_type_id")
    private BottleType bottleType;

    @Column(name = "sale_price", nullable = false, precision = 14, scale = 2)
    private BigDecimal salePrice;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Product() {
    }

    public Product(String sku, String name, String brand, String unit, Integer unitsPerCase, BottleType bottleType, BigDecimal salePrice) {
        this.sku = sku;
        this.name = name;
        this.brand = brand;
        this.unit = unit;
        this.unitsPerCase = unitsPerCase;
        this.bottleType = bottleType;
        this.salePrice = salePrice;
        this.active = true;
        this.createdAt = Instant.now();
    }

    public void update(String name, String brand, String unit, Integer unitsPerCase, BottleType bottleType, BigDecimal salePrice){
        this.name = name;
        this.brand = brand;
        this.unit = unit;
        this.unitsPerCase = unitsPerCase;
        this.bottleType = bottleType;
        this.salePrice = salePrice;
    }

    public void deactivate(){
        this.active = false;
    }

    public Long getId() { return id; }
    public String getSku() { return sku; }
    public String getName() { return name; }
    public String getBrand() { return brand; }
    public String getUnit() { return unit; }
    public Integer getUnitsPerCase() { return unitsPerCase; }
    public BottleType getBottleType() { return bottleType; }
    public BigDecimal getSalePrice() { return salePrice; }
    public boolean isActive() { return active; }
    public Instant getCreatedAt() { return createdAt; }
}