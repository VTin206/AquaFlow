
package com.aquaflow.customer.application;

import com.aquaflow.customer.api.dto.CustomerAddressRequest;
import com.aquaflow.customer.api.dto.CustomerAddressResponse;
import com.aquaflow.customer.domain.Customer;
import com.aquaflow.customer.domain.CustomerAddress;
import com.aquaflow.customer.repository.CustomerAddressRepository;
import com.aquaflow.customer.repository.CustomerRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerAddressServiceTest {

    @Mock
    private CustomerAddressRepository customerAddressRepository;

    @Mock
    private CustomerRepository customerRepository;

    @InjectMocks
    private CustomerAddressService customerAddressService;

    @Test
    void createSavesAddressWhenCustomerExists() {
        Customer customer = customer(5L);

        CustomerAddressRequest request = new CustomerAddressRequest(
                "Nguyen Van An",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5");

        when(customerRepository.findById(5L))
                .thenReturn(Optional.of(customer));

        when(customerAddressRepository.save(any(CustomerAddress.class)))
                .thenAnswer(invocation -> {
                    CustomerAddress saved = invocation.getArgument(0);
                    ReflectionTestUtils.setField(saved, "id", 12L);
                    return saved;
                });

        Optional<CustomerAddressResponse> result =
                customerAddressService.create(5L, request);

        assertThat(result).isPresent();

        CustomerAddressResponse response = result.orElseThrow();

        assertThat(response.id()).isEqualTo(12L);
        assertThat(response.customerId()).isEqualTo(5L);
        assertThat(response.recipientName()).isEqualTo("Nguyen Van An");
        assertThat(response.recipientPhone()).isEqualTo("0901234567");
        assertThat(response.addressLine()).isEqualTo("123 Nguyen Trai");
        assertThat(response.area()).isEqualTo("Quan 5");
        assertThat(response.isDefault()).isFalse();

        verify(customerAddressRepository).save(any(CustomerAddress.class));
    }

    @Test
    void createReturnsEmptyWhenCustomerDoesNotExist() {
        when(customerRepository.findById(999L))
                .thenReturn(Optional.empty());

        CustomerAddressRequest request = new CustomerAddressRequest(
                "Nguyen Van An",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5");

        Optional<CustomerAddressResponse> result =
                customerAddressService.create(999L, request);

        assertThat(result).isEmpty();

        verify(customerAddressRepository, never())
                .save(any(CustomerAddress.class));
    }

    @Test
    void findAllReturnsAddressesWhenCustomerExists() {
        Customer customer = customer(5L);
        CustomerAddress address = address(12L, customer);

        when(customerRepository.existsById(5L)).thenReturn(true);
        when(customerAddressRepository.findAllByCustomer_Id(5L))
                .thenReturn(List.of(address));

        Optional<List<CustomerAddressResponse>> result =
                customerAddressService.findAllByCustomerId(5L);

        assertThat(result).isPresent();
        assertThat(result.orElseThrow()).hasSize(1);

        CustomerAddressResponse response =
                result.orElseThrow().get(0);

        assertThat(response.id()).isEqualTo(12L);
        assertThat(response.customerId()).isEqualTo(5L);
        assertThat(response.recipientName()).isEqualTo("Nguyen Van An");

        verify(customerAddressRepository).findAllByCustomer_Id(5L);
    }

    @Test
    void findAllReturnsEmptyWhenCustomerDoesNotExist() {
        when(customerRepository.existsById(999L)).thenReturn(false);

        Optional<List<CustomerAddressResponse>> result =
                customerAddressService.findAllByCustomerId(999L);

        assertThat(result).isEmpty();

        verify(customerAddressRepository, never())
                .findAllByCustomer_Id(999L);
    }

    @Test
    void findByIdReturnsAddressWhenItBelongsToCustomer() {
        CustomerAddress address = address(12L, customer(5L));

        when(customerAddressRepository.findByIdAndCustomer_Id(12L, 5L))
                .thenReturn(Optional.of(address));

        Optional<CustomerAddressResponse> result =
                customerAddressService.findById(5L, 12L);

        assertThat(result).isPresent();
        assertThat(result.orElseThrow().id()).isEqualTo(12L);
        assertThat(result.orElseThrow().customerId()).isEqualTo(5L);

        verify(customerAddressRepository)
                .findByIdAndCustomer_Id(12L, 5L);
    }

    @Test
    void findByIdReturnsEmptyWhenAddressDoesNotMatchCustomer() {
        when(customerAddressRepository.findByIdAndCustomer_Id(12L, 7L))
                .thenReturn(Optional.empty());

        Optional<CustomerAddressResponse> result =
                customerAddressService.findById(7L, 12L);

        assertThat(result).isEmpty();
    }

    @Test
    void updateChangesAddressDetails() {
        CustomerAddress address = address(12L, customer(5L));

        CustomerAddressRequest request = new CustomerAddressRequest(
                "Tran Thi Binh",
                "0987654321",
                "456 Le Loi",
                "Quan 1");

        when(customerAddressRepository.findByIdAndCustomer_Id(12L, 5L))
                .thenReturn(Optional.of(address));

        when(customerAddressRepository.save(any(CustomerAddress.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Optional<CustomerAddressResponse> result =
                customerAddressService.update(5L, 12L, request);

        assertThat(result).isPresent();

        CustomerAddressResponse response = result.orElseThrow();

        assertThat(response.id()).isEqualTo(12L);
        assertThat(response.customerId()).isEqualTo(5L);
        assertThat(response.recipientName()).isEqualTo("Tran Thi Binh");
        assertThat(response.recipientPhone()).isEqualTo("0987654321");
        assertThat(response.addressLine()).isEqualTo("456 Le Loi");
        assertThat(response.area()).isEqualTo("Quan 1");

        verify(customerAddressRepository).save(address);
    }

    @Test
    void updateReturnsEmptyWhenAddressDoesNotMatchCustomer() {
        when(customerAddressRepository.findByIdAndCustomer_Id(12L, 7L))
                .thenReturn(Optional.empty());

        CustomerAddressRequest request = new CustomerAddressRequest(
                "Tran Thi Binh",
                "0987654321",
                "456 Le Loi",
                "Quan 1");

        Optional<CustomerAddressResponse> result =
                customerAddressService.update(7L, 12L, request);

        assertThat(result).isEmpty();

        verify(customerAddressRepository, never())
                .save(any(CustomerAddress.class));
    }

    @Test
    void deleteRemovesAddressWhenFound() {
        CustomerAddress address = address(12L, customer(5L));

        when(customerAddressRepository.findByIdAndCustomer_Id(12L, 5L))
                .thenReturn(Optional.of(address));

        boolean deleted = customerAddressService.delete(5L, 12L);

        assertThat(deleted).isTrue();

        verify(customerAddressRepository)
                .delete(address);
    }

    @Test
    void deleteReturnsFalseWhenAddressDoesNotMatchCustomer() {
        when(customerAddressRepository.findByIdAndCustomer_Id(12L, 7L))
                .thenReturn(Optional.empty());

        boolean deleted = customerAddressService.delete(7L, 12L);

        assertThat(deleted).isFalse();

        verify(customerAddressRepository, never())
                .delete(any(CustomerAddress.class));
    }

    private Customer customer(Long id) {
        Customer customer = new Customer(
                "Nguyen Van An",
                "0901234567");

        ReflectionTestUtils.setField(customer, "id", id);

        return customer;
    }

    private CustomerAddress address(Long id, Customer customer) {
        CustomerAddress address = new CustomerAddress(
                customer,
                "Nguyen Van An",
                "0901234567",
                "123 Nguyen Trai",
                "Quan 5");

        ReflectionTestUtils.setField(address, "id", id);

        return address;
    }
}
