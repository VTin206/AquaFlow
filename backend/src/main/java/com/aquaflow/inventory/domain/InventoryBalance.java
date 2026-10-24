package com.aquaflow.inventory.domain;

import com.aquaflow.shared.api.ConflictException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "inventory_balances")
public class InventoryBalance {
    @Id
    @Column(name = "batch_id")
    private Long batchId;

    @MapsId
    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id")
    private ProductBatch batch;

    @Column(name = "on_hand", nullable = false)
    private Integer onHand;

    @Column(nullable = false)
    private Integer reserved;

    @Version
    @Column(nullable = false)
    private Long version;

    protected InventoryBalance() {
    }

    public InventoryBalance(ProductBatch batch) {
        this.batch = batch;
        this.onHand = 0;
        this.reserved = 0;
    }

    public int getAvailable() {
        return onHand - reserved;
    }

    public void receive(int quantity) {
        requirePositive(quantity);
        onHand += quantity;
    }

    public void reserve(int quantity) {
        requirePositive(quantity);
        if (quantity > getAvailable()) {
            throw new ConflictException("Lô " + batch.getLotCode() + " không đủ hàng khả dụng");
        }
        reserved += quantity;
    }

    public void release(int quantity) {
        requirePositive(quantity);
        if (quantity > reserved) {
            throw new IllegalStateException("Giải phóng vượt số lượng đang giữ");
        }
        reserved -= quantity;
    }

    private static void requirePositive(int quantity) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("Số lượng phải lớn hơn 0");
        }
    }

    public Long getBatchId() { return batchId; }
    public ProductBatch getBatch() { return batch; }
    public Integer getOnHand() { return onHand; }
    public Integer getReserved() { return reserved; }
    public Long getVersion() { return version; }
}
