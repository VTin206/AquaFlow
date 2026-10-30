package com.aquaflow.inventory.application;

import com.aquaflow.inventory.api.dto.SupplierRequest;
import com.aquaflow.inventory.api.dto.SupplierResponse;
import com.aquaflow.inventory.domain.Supplier;
import com.aquaflow.inventory.repository.SupplierRepository;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SupplierService {

    private final SupplierRepository supplierRepository;

    public SupplierService(SupplierRepository supplierRepository) {
        this.supplierRepository = supplierRepository;
    }

    @Transactional(readOnly = true)
    public List<SupplierResponse> findAll(Boolean active) {
        List<Supplier> suppliers = (active == null)
            ? supplierRepository.findAll()
            : supplierRepository.findByActive(active);
        return suppliers.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public SupplierResponse findById(Long id) {
        return toResponse(getSupplier(id));
    }

    @Transactional
    public SupplierResponse create(SupplierRequest request) {
        Supplier supplier = new Supplier(request.name(), request.phone(), request.address());
        supplier.updateContact(request.contactName(), request.email());
        return toResponse(supplierRepository.save(supplier));
    }

    @Transactional
    public SupplierResponse update(Long id, SupplierRequest request) {
        Supplier supplier = getSupplier(id);
        supplier.update(request.name(), request.phone(), request.address());
        supplier.updateContact(request.contactName(), request.email());
        return toResponse(supplier);          // không cần save(), @Transactional tự lưu
    }

    @Transactional
    public void delete(Long id) {
        getSupplier(id).deactivate();         // xóa mềm
    }

    private Supplier getSupplier(Long id) {
        return supplierRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Supplier not found: " + id));
    }

    private SupplierResponse toResponse(Supplier supplier) {
        return new SupplierResponse(
                supplier.getId(),
                supplier.getName(),
                supplier.getPhone(),
                supplier.getAddress(),
                supplier.isActive(),
                supplier.getContactName(),
                supplier.getEmail());
    }
}