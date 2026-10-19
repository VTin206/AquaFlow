package com.aquaflow.inventory.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;

@Entity
@Table(name = "bottle_types")
public class BottleType {
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100, unique = true)
    private String name;

    @Column(name = "deposit_unit_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal depositUnitAmount;

    @Column(nullable = false)
    private boolean active;

    protected BottleType(){
    }

    public BottleType(String name, BigDecimal depositUnitAmount){
        this.name = name;
        this.depositUnitAmount = depositUnitAmount;
        this.active = true;
    }

    public void update(BigDecimal depositUnitAmount){
        this.depositUnitAmount = depositUnitAmount;
    }

    public void deactivate(){
        this.active = false;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getDepositUnitAmount() {
        return depositUnitAmount;
    }

    public boolean isActive() {
        return active;
    }
}