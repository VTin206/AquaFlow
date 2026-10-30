package com.aquaflow.inventory.domain;

import com.aquaflow.shared.api.ConflictException;
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

    // Hàng đã xuất được trả về kho và đạt điều kiện bán lại
    @Column(name = "quantity_returned", nullable = false)
    private Integer quantityReturned;

    // Hàng đã xuất được trả về nhưng hư hỏng, không nhập lại tồn
    @Column(name = "quantity_damaged", nullable = false)
    private Integer quantityDamaged;

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
        this.quantityReturned = 0;
        this.quantityDamaged = 0;
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

    /** Hàng đã xuất nhưng chưa được kiểm tra trả về (đang ở ngoài kho hoặc đã giao). */
    public int getUnreturnedDispatched() {
        return quantityDispatched - quantityReturned - quantityDamaged;
    }

    /** Xuất toàn bộ phần đang giữ; không cho xuất một phần hay xuất lại. Trả về số lượng vừa xuất. */
    public int dispatchAll() {
        if (quantityDispatched > 0 || quantityReleased > 0) {
            throw new ConflictException("Reservation " + id + " đã được xử lý, không thể xuất kho");
        }
        quantityDispatched = quantityReserved;
        return quantityDispatched;
    }

    /** Ghi nhận kết quả kiểm tra hàng hoàn; không giảm ngược quantityDispatched. */
    public void recordReturn(int resellable, int damaged) {
        if (resellable < 0 || damaged < 0 || resellable + damaged == 0) {
            throw new IllegalArgumentException("Số lượng hàng hoàn không hợp lệ");
        }
        if (resellable + damaged > getUnreturnedDispatched()) {
            throw new ConflictException("Số lượng hàng hoàn vượt số đã xuất của lô " + batch.getLotCode());
        }
        quantityReturned += resellable;
        quantityDamaged += damaged;
    }

    public Long getId() { return id; }
    public Long getOrderItemId() { return orderItemId; }
    public ProductBatch getBatch() { return batch; }
    public Integer getQuantityReserved() { return quantityReserved; }
    public Integer getQuantityDispatched() { return quantityDispatched; }
    public Integer getQuantityReleased() { return quantityReleased; }
    public Integer getQuantityReturned() { return quantityReturned; }
    public Integer getQuantityDamaged() { return quantityDamaged; }
}
