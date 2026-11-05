package com.aquaflow.inventory.application;

import com.aquaflow.inventory.api.dto.SupplierRequest;
import com.aquaflow.inventory.api.dto.SupplierResponse;
import com.aquaflow.inventory.domain.Supplier;
import com.aquaflow.inventory.repository.SupplierRepository;
import com.aquaflow.shared.api.NotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SupplierServiceTest {

    @Mock
    private SupplierRepository supplierRepository;

    @InjectMocks
    private SupplierService supplierService;

    @Test
    void createReturnsActiveSupplier() {
        // Mock không tự lưu gì: dặn nó "save trả lại đúng object được truyền vào"
        when(supplierRepository.save(any(Supplier.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SupplierResponse response = supplierService.create(
                new SupplierRequest("Aqua Supplier", "0987654321", "123 Main St"));

        assertThat(response.name()).isEqualTo("Aqua Supplier");
        assertThat(response.phone()).isEqualTo("0987654321");
        assertThat(response.address()).isEqualTo("123 Main St");
        assertThat(response.active()).isTrue();
    }

    @Test
    void findAllWithoutFilterReturnsEverySupplier() {
        when(supplierRepository.findAll()).thenReturn(List.of(supplier("A"), supplier("B")));

        List<SupplierResponse> result = supplierService.findAll(null);

        assertThat(result).hasSize(2);
        verify(supplierRepository, never()).findByActive(anyBoolean());
    }

    @Test
    void findAllWithActiveTrueUsesActiveFilter() {
        when(supplierRepository.findByActive(true)).thenReturn(List.of(supplier("A")));

        List<SupplierResponse> result = supplierService.findAll(true);

        assertThat(result).hasSize(1);
        verify(supplierRepository).findByActive(true);
        verify(supplierRepository, never()).findAll();
    }

    @Test
    void findByIdThrowsWhenSupplierMissing() {
        when(supplierRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> supplierService.findById(99L))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("99");
    }

    @Test
    void updateChangesSupplierFields() {
        Supplier existing = supplier("Old name");
        when(supplierRepository.findById(1L)).thenReturn(Optional.of(existing));

        SupplierResponse response = supplierService.update(1L,
                new SupplierRequest("New name", "0911222333", "456 New St"));

        assertThat(response.name()).isEqualTo("New name");
        assertThat(existing.getPhone()).isEqualTo("0911222333");
        assertThat(existing.getAddress()).isEqualTo("456 New St");
    }

    @Test
    void updateThrowsWhenSupplierMissing() {
        when(supplierRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> supplierService.update(99L,
                new SupplierRequest("New name", null, null)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void deleteDeactivatesSupplierInsteadOfRemovingIt() {
        Supplier existing = supplier("A");
        when(supplierRepository.findById(1L)).thenReturn(Optional.of(existing));

        supplierService.delete(1L);

        assertThat(existing.isActive()).isFalse();
        verify(supplierRepository, never()).delete(any());
    }

    private Supplier supplier(String name) {
        return new Supplier(name, "0987654321", "123 Main St");
    }

    @Test
    void createAndUpdateKeepContactFieldsAndOlderClientsDoNotEraseThem() {
        when(supplierRepository.save(any(Supplier.class))).thenAnswer(invocation -> invocation.getArgument(0));
        SupplierResponse created = supplierService.create(new SupplierRequest(
                "Aqua Supplier", "0987654321", "123 Main St", " Chị Lan ", "lan@aqua.vn"));
        assertThat(created.contactName()).isEqualTo("Chị Lan");
        assertThat(created.email()).isEqualTo("lan@aqua.vn");

        Supplier existing = supplier("Old name");
        existing.updateContact("Anh Minh", "minh@aqua.vn");
        when(supplierRepository.findById(1L)).thenReturn(Optional.of(existing));
        SupplierResponse kept = supplierService.update(1L, new SupplierRequest("New name", "0911222333", "456 New St"));
        assertThat(kept.contactName()).isEqualTo("Anh Minh");
        assertThat(kept.email()).isEqualTo("minh@aqua.vn");

        SupplierResponse cleared = supplierService.update(1L,
                new SupplierRequest("New name", "0911222333", "456 New St", "", ""));
        assertThat(cleared.contactName()).isNull();
        assertThat(cleared.email()).isNull();
    }
}
