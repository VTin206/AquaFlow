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

@Entity
@Table(name = "purchase_items")
public class PurchaseItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "receipt_id", nullable = false)
    private PurchaseReceipt receipt;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id")
    private ProductBatch batch;

    @Column(name = "quantity_received", nullable = false)
    private Integer quantityReceived;

    @Column(name = "quantity_accepted", nullable = false)
    private Integer quantityAccepted;

    @Column(name = "unit_cost", nullable = false, precision = 14, scale = 2)
    private BigDecimal unitCost;

    protected PurchaseItem() {
    }

    public PurchaseItem(Product product, ProductBatch batch, int quantityReceived, int quantityAccepted, BigDecimal unitCost) {
        if (quantityReceived <= 0) {
            throw new IllegalArgumentException("Số lượng nhận phải lớn hơn 0");
        }
        if (quantityAccepted < 0 || quantityAccepted > quantityReceived) {
            throw new IllegalArgumentException("Số lượng chấp nhận phải từ 0 đến số lượng nhận");
        }
        this.product = product;
        this.batch = batch;
        this.quantityReceived = quantityReceived;
        this.quantityAccepted = quantityAccepted;
        this.unitCost = unitCost;
    }

    void attachTo(PurchaseReceipt receipt) {
        this.receipt = receipt;
    }

    public Long getId() { return id; }
    public PurchaseReceipt getReceipt() { return receipt; }
    public Product getProduct() { return product; }
    public ProductBatch getBatch() { return batch; }
    public Integer getQuantityReceived() { return quantityReceived; }
    public Integer getQuantityAccepted() { return quantityAccepted; }
    /** Hàng thiếu/hỏng: ghi nhận để đối chiếu NCC, không cộng vào tồn có thể bán. */
    public int getQuantityRejected() { return quantityReceived - quantityAccepted; }
    public BigDecimal getUnitCost() { return unitCost; }
}
