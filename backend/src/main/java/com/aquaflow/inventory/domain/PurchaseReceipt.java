package com.aquaflow.inventory.domain;

import com.aquaflow.shared.api.ConflictException;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Entity
@Table(name = "purchase_receipts")
public class PurchaseReceipt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PurchaseReceiptStatus status;

    @Column(name = "received_at")
    private Instant receivedAt;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "confirmed_by")
    private Long confirmedBy;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    @Column(columnDefinition = "TEXT")
    private String note;

    @OneToMany(mappedBy = "receipt", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PurchaseItem> items = new ArrayList<>();

    protected PurchaseReceipt() {
    }

    public PurchaseReceipt(Supplier supplier, Instant receivedAt, Long createdBy, String note) {
        this.supplier = supplier;
        this.receivedAt = receivedAt;
        this.createdBy = createdBy;
        this.note = note;
        this.status = PurchaseReceiptStatus.DRAFT;
    }

    public void update(Supplier supplier, Instant receivedAt, String note) {
        ensureDraft();
        this.supplier = supplier;
        this.receivedAt = receivedAt;
        this.note = note;
    }

    public void addItem(PurchaseItem item) {
        ensureDraft();
        item.attachTo(this);
        items.add(item);
    }

    public void clearItems() {
        ensureDraft();
        items.clear();
    }

    public void confirm(Long userId) {
        ensureDraft();
        if (items.isEmpty()) {
            throw new ConflictException("Phiếu nhập phải có ít nhất một dòng hàng");
        }
        this.status = PurchaseReceiptStatus.CONFIRMED;
        this.confirmedBy = userId;
        this.confirmedAt = Instant.now();
    }

    public void cancel() {
        ensureDraft();
        this.status = PurchaseReceiptStatus.CANCELLED;
    }

    private void ensureDraft() {
        if (status != PurchaseReceiptStatus.DRAFT) {
            throw new ConflictException("Chỉ thao tác được trên phiếu nhập ở trạng thái DRAFT");
        }
    }

    public Long getId() { return id; }
    public Supplier getSupplier() { return supplier; }
    public PurchaseReceiptStatus getStatus() { return status; }
    public Instant getReceivedAt() { return receivedAt; }
    public Long getCreatedBy() { return createdBy; }
    public Long getConfirmedBy() { return confirmedBy; }
    public Instant getConfirmedAt() { return confirmedAt; }
    public String getNote() { return note; }
    public List<PurchaseItem> getItems() { return Collections.unmodifiableList(items); }
}
