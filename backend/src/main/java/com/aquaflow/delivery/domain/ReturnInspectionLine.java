package com.aquaflow.delivery.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "return_inspection_lines")
public class ReturnInspectionLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "inspection_id", nullable = false)
    private Long inspectionId;

    @Column(name = "load_item_id", nullable = false)
    private Long loadItemId;

    @Column(name = "quantity_resellable", nullable = false)
    private int quantityResellable;

    @Column(name = "quantity_damaged", nullable = false)
    private int quantityDamaged;

    @Column(columnDefinition = "TEXT")
    private String note;

    protected ReturnInspectionLine() {
    }

    public ReturnInspectionLine(
            Long inspectionId,
            Long loadItemId,
            int quantityResellable,
            int quantityDamaged,
            String note) {

        if (inspectionId == null || inspectionId <= 0) {
            throw new IllegalArgumentException(
                    "Inspection ID must be positive");
        }

        if (loadItemId == null || loadItemId <= 0) {
            throw new IllegalArgumentException(
                    "Load item ID must be positive");
        }

        if (quantityResellable < 0 || quantityDamaged < 0) {
            throw new IllegalArgumentException(
                    "Inspection quantities cannot be negative");
        }

        if (quantityResellable + quantityDamaged == 0) {
            throw new IllegalArgumentException(
                    "At least one inspected quantity must be positive");
        }

        this.inspectionId = inspectionId;
        this.loadItemId = loadItemId;
        this.quantityResellable = quantityResellable;
        this.quantityDamaged = quantityDamaged;
        this.note = note;
    }

    public Long getId() {
        return id;
    }

    public Long getInspectionId() {
        return inspectionId;
    }

    public Long getLoadItemId() {
        return loadItemId;
    }

    public int getQuantityResellable() {
        return quantityResellable;
    }

    public int getQuantityDamaged() {
        return quantityDamaged;
    }

    public String getNote() {
        return note;
    }

    public int getTotalInspected() {
        return quantityResellable + quantityDamaged;
    }
}
