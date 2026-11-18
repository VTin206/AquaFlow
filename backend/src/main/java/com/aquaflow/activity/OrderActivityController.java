package com.aquaflow.activity;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Nhật ký của một đơn cho nhân viên bán hàng; nhật ký toàn cửa hàng vẫn chỉ ADMIN xem (ActivityController). */
@RestController
@RequestMapping("/api/v1/sales/orders/{orderId}/activity")
@Tag(name = "Activity logs")
@SecurityRequirement(name = "bearerAuth")
public class OrderActivityController {
    private final ActivityRepository repository;

    public OrderActivityController(ActivityRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    @Operation(summary = "Activity of one order, oldest first",
            description = "Business actions on the order, its dispatch, delivery results, returned goods and payments. "
                    + "Recorded since activity logging was enabled; at most the latest 500 entries.")
    public List<ActivityRepository.OrderEntry> list(@PathVariable long orderId) {
        return repository.forOrder(orderId);
    }
}
