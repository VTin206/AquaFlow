package com.aquaflow.customer.application;

import com.aquaflow.customer.api.dto.CustomerRequest;
import com.aquaflow.customer.api.dto.CustomerResponse;
import com.aquaflow.customer.domain.Customer;
import com.aquaflow.customer.repository.CustomerRepository;
import com.aquaflow.shared.api.ConflictException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerServiceTest {

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private CustomerAuditService customerAuditService;

    @InjectMocks
    private CustomerService customerService;

    @Test
    void createSavesCustomerAndReturnsResponse() {
        CustomerRequest request =
                new CustomerRequest("Nguyen Van An", "0901234567");

        when(customerRepository.save(any(Customer.class)))
                .thenAnswer(invocation -> {
                    Customer saved = invocation.getArgument(0);
                    ReflectionTestUtils.setField(saved, "id", 101L);
                    return saved;
                });

        CustomerResponse response = customerService.create(request);

        assertThat(response.id()).isEqualTo(101L);
        assertThat(response.fullName()).isEqualTo("Nguyen Van An");
        assertThat(response.phone()).isEqualTo("0901234567");
        assertThat(response.createdAt()).isNotNull();

        ArgumentCaptor<Customer> captor =
                ArgumentCaptor.forClass(Customer.class);

        verify(customerRepository).save(captor.capture());

        assertThat(captor.getValue().getFullName())
                .isEqualTo("Nguyen Van An");
        assertThat(captor.getValue().getPhone())
                .isEqualTo("0901234567");
    }

    @Test
    void createRejectsExistingActivePhoneAfterCountryCodeNormalization() {
        when(customerRepository.existsByPhoneAndActiveTrue("0901234567")).thenReturn(true);

        assertThatThrownBy(() -> customerService.create(new CustomerRequest("Nguyen Van An", "+84901234567")))
                .isInstanceOf(ConflictException.class);

        verify(customerRepository, never()).save(any(Customer.class));
    }

    @Test
    void findAllReturnsCustomerResponses() {
        Customer customer =
                customer(1L, "Nguyen Van An", "0901234567");

        when(customerRepository.findAllByActiveTrue())
                .thenReturn(List.of(customer));

        List<CustomerResponse> responses = customerService.findAll();

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).id()).isEqualTo(1L);
        assertThat(responses.get(0).fullName())
                .isEqualTo("Nguyen Van An");
    }

    @Test
    void findByIdReturnsCustomerWhenFound() {
        Customer customer =
                customer(2L, "Tran Thi Binh", "0912345678");

        when(customerRepository.findByIdAndActiveTrue(2L))
                .thenReturn(Optional.of(customer));

        Optional<CustomerResponse> response =
                customerService.findById(2L);

        assertThat(response).isPresent();
        assertThat(response.get().id()).isEqualTo(2L);
        assertThat(response.get().fullName())
                .isEqualTo("Tran Thi Binh");
    }

    @Test
    void findByIdReturnsEmptyWhenCustomerDoesNotExist() {
        when(customerRepository.findByIdAndActiveTrue(999L))
                .thenReturn(Optional.empty());

        Optional<CustomerResponse> response =
                customerService.findById(999L);

        assertThat(response).isEmpty();
    }

    @Test
    void updateChangesCustomerDetails() {
        Customer customer =
                customer(3L, "Nguyen Van An", "0901234567");

        CustomerRequest request =
                new CustomerRequest(
                        "Nguyen Van An Updated",
                        "0987654321");

        when(customerRepository.findByIdAndActiveTrue(3L))
                .thenReturn(Optional.of(customer));

        when(customerRepository.save(any(Customer.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Optional<CustomerResponse> result =
                customerService.update(3L, request);

        assertThat(result).isPresent();
        assertThat(result.get().id()).isEqualTo(3L);
        assertThat(result.get().fullName())
                .isEqualTo("Nguyen Van An Updated");
        assertThat(result.get().phone()).isEqualTo("0987654321");

        verify(customerRepository).save(customer);

        verify(customerAuditService).recordUpdate(
                eq("CUSTOMER"),
                eq(3L),
                anyMap(),
                anyMap());
    }

    @Test
    void updateReturnsEmptyWhenCustomerDoesNotExist() {
        when(customerRepository.findByIdAndActiveTrue(999L))
                .thenReturn(Optional.empty());

        Optional<CustomerResponse> result =
                customerService.update(
                        999L,
                        new CustomerRequest(
                                "Nguyen Van An",
                                "0901234567"));

        assertThat(result).isEmpty();

        verify(customerRepository, never())
                .save(any(Customer.class));
    }

    @Test
    void deleteDeactivatesExistingCustomer() {
        Customer customer =
                customer(4L, "Nguyen Van An", "0901234567");

        when(customerRepository.findByIdAndActiveTrue(4L))
                .thenReturn(Optional.of(customer));

        boolean deleted = customerService.delete(4L);

        assertThat(deleted).isTrue();
        assertThat(customer.isActive()).isFalse();

        verify(customerRepository).save(customer);
    }

    @Test
    void deleteReturnsFalseWhenCustomerDoesNotExist() {
        when(customerRepository.findByIdAndActiveTrue(999L))
                .thenReturn(Optional.empty());

        boolean deleted = customerService.delete(999L);

        assertThat(deleted).isFalse();

        verify(customerRepository, never())
                .save(any(Customer.class));
    }

    private Customer customer(
            Long id,
            String fullName,
            String phone) {

        Customer customer = new Customer(fullName, phone);

        ReflectionTestUtils.setField(customer, "id", id);

        return customer;
    }

    @Test
    void profileFieldsDefaultToIndividualAndOlderClientsDoNotEraseThem() {
        when(customerRepository.save(any(Customer.class))).thenAnswer(invocation -> invocation.getArgument(0));
        CustomerResponse plain = customerService.create(new CustomerRequest("Nguyen Van An", "0901234567"));
        assertThat(plain.customerType()).isEqualTo("Cá nhân");
        assertThat(plain.area()).isNull();

        Customer customer = customer(3L, "Cong ty Song Xanh", "0987654321");
        when(customerRepository.findByIdAndActiveTrue(3L)).thenReturn(Optional.of(customer));
        CustomerResponse updated = customerService.update(3L, new CustomerRequest(
                "Cong ty Song Xanh", "0987654321", "Doanh nghiệp", " Quận 1 ", "Giao giờ hành chính")).orElseThrow();
        assertThat(updated.customerType()).isEqualTo("Doanh nghiệp");
        assertThat(updated.area()).isEqualTo("Quận 1");
        assertThat(updated.note()).isEqualTo("Giao giờ hành chính");

        CustomerResponse kept = customerService.update(3L, new CustomerRequest("Cong ty Song Xanh", "0987654321")).orElseThrow();
        assertThat(kept.customerType()).isEqualTo("Doanh nghiệp");
        assertThat(kept.area()).isEqualTo("Quận 1");

        CustomerResponse cleared = customerService.update(3L, new CustomerRequest(
                "Cong ty Song Xanh", "0987654321", null, "", "")).orElseThrow();
        assertThat(cleared.area()).isNull();
        assertThat(cleared.note()).isNull();
    }
}
