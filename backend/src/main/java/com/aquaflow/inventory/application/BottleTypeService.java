package com.aquaflow.inventory.application;

import com.aquaflow.inventory.domain.BottleType;
import com.aquaflow.inventory.repository.BottleTypeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.aquaflow.inventory.api.dto.BottleTypeResponse;
import com.aquaflow.inventory.api.dto.CreateBottleTypeRequest;
import com.aquaflow.inventory.api.dto.UpdateBottleTypeRequest;
import java.util.List;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;

@Service
public class BottleTypeService {
    private final BottleTypeRepository bottleTypeRepository;

    public BottleTypeService(BottleTypeRepository bottleTypeRepository){
        this.bottleTypeRepository = bottleTypeRepository;
    }

    @Transactional(readOnly = true)
    public List<BottleTypeResponse> findAll(Boolean active) {
        List<BottleType> bottleTypes = (active == null)
                ? bottleTypeRepository.findAll()
                : bottleTypeRepository.findByActive(active);
        return bottleTypes.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public BottleTypeResponse findById(Long id) {
        return toResponse(getBottleType(id));
    }

    @Transactional
    public BottleTypeResponse create(CreateBottleTypeRequest request) {
        if (bottleTypeRepository.existsByName(request.name())) {
            throw new ConflictException("Bottle type already exists: " + request.name());
        }
        BottleType bottleType = new BottleType(request.name(), request.depositUnitAmount());
        return toResponse(bottleTypeRepository.save(bottleType));
    }

    @Transactional
    public BottleTypeResponse update(Long id, UpdateBottleTypeRequest request) {
        BottleType bottleType = getBottleType(id);
        if (request.depositUnitAmount() != null) {
            bottleType.update(request.depositUnitAmount());
        }
        return toResponse(bottleType);
    }

    @Transactional
    public void delete(Long id) {
        getBottleType(id).deactivate();
    }

    private BottleType getBottleType(Long id) {
        return bottleTypeRepository.findById(id).orElseThrow(() -> new NotFoundException("BottleType not found: " + id));
    }

    private BottleTypeResponse toResponse(BottleType bottleType) {
        return new BottleTypeResponse(
            bottleType.getId(),
            bottleType.getName(),
            bottleType.getDepositUnitAmount(),
            bottleType.isActive());
    }
}