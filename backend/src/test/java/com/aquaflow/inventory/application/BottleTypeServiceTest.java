package com.aquaflow.inventory.application;

import com.aquaflow.inventory.api.dto.BottleTypeResponse;
import com.aquaflow.inventory.api.dto.CreateBottleTypeRequest;
import com.aquaflow.inventory.api.dto.UpdateBottleTypeRequest;
import com.aquaflow.inventory.domain.BottleType;
import com.aquaflow.inventory.repository.BottleTypeRepository;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BottleTypeServiceTest {

    @Mock
    private BottleTypeRepository bottleTypeRepository;

    @InjectMocks
    private BottleTypeService bottleTypeService;

    @Test
    void createReturnsActiveBottleType() {
        when(bottleTypeRepository.existsByName("Bình 19L")).thenReturn(false);
        when(bottleTypeRepository.save(any(BottleType.class))).thenAnswer(invocation -> invocation.getArgument(0));

        BottleTypeResponse response = bottleTypeService.create(
                new CreateBottleTypeRequest("Bình 19L", new BigDecimal("50000")));

        assertThat(response.name()).isEqualTo("Bình 19L");
        assertThat(response.depositUnitAmount()).isEqualByComparingTo("50000");
        assertThat(response.active()).isTrue();
    }

    @Test
    void createRejectsDuplicateName() {
        when(bottleTypeRepository.existsByName("Bình 19L")).thenReturn(true);

        assertThatThrownBy(() -> bottleTypeService.create(
                new CreateBottleTypeRequest("Bình 19L", new BigDecimal("50000"))))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Bình 19L");
        verify(bottleTypeRepository, never()).save(any());
    }

    @Test
    void updateChangesDepositAmount() {
        BottleType existing = new BottleType("Bình 19L", new BigDecimal("50000"));
        when(bottleTypeRepository.findById(1L)).thenReturn(Optional.of(existing));

        bottleTypeService.update(1L, new UpdateBottleTypeRequest(new BigDecimal("60000")));

        assertThat(existing.getDepositUnitAmount()).isEqualByComparingTo("60000");
    }

    @Test
    void updateThrowsWhenBottleTypeMissing() {
        when(bottleTypeRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> bottleTypeService.update(99L,
                new UpdateBottleTypeRequest(new BigDecimal("60000"))))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void deleteDeactivatesBottleType() {
        BottleType existing = new BottleType("Bình 19L", new BigDecimal("50000"));
        when(bottleTypeRepository.findById(1L)).thenReturn(Optional.of(existing));

        bottleTypeService.delete(1L);

        assertThat(existing.isActive()).isFalse();
        verify(bottleTypeRepository, never()).delete(any());
    }
}
