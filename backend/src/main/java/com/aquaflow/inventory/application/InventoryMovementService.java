package com.aquaflow.inventory.application;

import com.aquaflow.inventory.api.dto.InventoryMovementResponse;
import com.aquaflow.inventory.domain.MovementType;
import com.aquaflow.inventory.repository.InventoryMovementReadRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class InventoryMovementService {
    private final InventoryMovementReadRepository repository;
    public InventoryMovementService(InventoryMovementReadRepository repository) { this.repository = repository; }
    public record MovementPage(List<InventoryMovementResponse> content, int page, int size, long totalElements) {}

    public MovementPage list(MovementType type, Long productId, Instant from, Instant to, String q, int page, int size) {
        if (page < 0 || page > 100000 || size < 1 || size > 100) throw new BadRequestException("page từ 0 đến 100000, size từ 1 đến 100");
        if (productId != null && productId <= 0) throw new BadRequestException("productId phải lớn hơn 0");
        if (q != null && q.length() > 200) throw new BadRequestException("Từ khóa tối đa 200 ký tự");
        if (from != null && to != null && !from.isBefore(to)) throw new BadRequestException("Thời điểm bắt đầu phải trước thời điểm kết thúc");
        var result = repository.list(type, productId, from, to, q, page, size);
        return new MovementPage(result.content(), page, size, result.totalElements());
    }

    public InventoryMovementResponse find(long id) {
        return repository.find(id).orElseThrow(() -> new NotFoundException("Không tìm thấy giao dịch kho"));
    }
}
