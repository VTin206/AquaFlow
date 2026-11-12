package com.aquaflow.inventory.application;

import com.aquaflow.inventory.repository.BestSellerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.util.List;

/** Danh sách "Bán chạy" trên trang khách: top 5 sản phẩm theo số lượng đã giao trong 30 ngày gần nhất. */
@Service
public class BestSellerService {
    static final Duration WINDOW = Duration.ofDays(30);
    static final int LIMIT = 5;
    /** Bán quá ít thì chưa gắn nhãn, để cửa hàng mới hoặc vắng đơn không gắn nhãn cho có. */
    static final int MIN_QUANTITY = 3;

    private final BestSellerRepository repository;
    private final Clock clock;

    public BestSellerService(BestSellerRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    /** Mã sản phẩm bán chạy, nhiều nhất trước; rỗng khi chưa đủ dữ liệu. */
    @Transactional(readOnly = true)
    public List<Long> productIds() {
        return repository.topProductIds(clock.instant().minus(WINDOW), MIN_QUANTITY, LIMIT);
    }
}
