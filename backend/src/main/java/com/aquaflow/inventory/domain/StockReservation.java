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

@Entity
@Table(name = "stock_reservations")
public class StockReservation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Giữ id thay vì entity để module inventory không phụ thuộc module order
    @Column(name = "order_item_id", nullable = false)
    private Long orderItemId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private ProductBatch batch;

    @Column(name = "quantity_reserved", nullable = false)
    private Integer quantityReserved;

    @Column(name = "quantity_dispatched", nullable = false)
    private Integer quantityDispatched;

    @Column(name = "quantity_released", nullable = false)
    private Integer quantityReleased;

    protected StockReservation() {
    }

    public StockReservation(Long orderItemId, ProductBatch batch, int quantityReserved) {
        if (quantityReserved <= 0) {
            throw new IllegalArgumentException("Số lượng giữ phải lớn hơn 0");
        }
        this.orderItemId = orderItemId;
        this.batch = batch;
        this.quantityReserved = quantityReserved;
        this.quantityDispatched = 0;
        this.quantityReleased = 0;
    }

    public int getOutstanding() {
        return quantityReserved - quantityDispatched - quantityReleased;
    }

    /** Giải phóng toàn bộ phần chưa xuất; trả về số lượng vừa giải phóng. */
    public int releaseOutstanding() {
        int outstanding = getOutstanding();
        quantityReleased += outstanding;
        return outstanding;
    }

    public Long getId() { return id; }
    public Long getOrderItemId() { return orderItemId; }
    public ProductBatch getBatch() { return batch; }
    public Integer getQuantityReserved() { return quantityReserved; }
    public Integer getQuantityDispatched() { return quantityDispatched; }
    public Integer getQuantityReleased() { return quantityReleased; }
}
