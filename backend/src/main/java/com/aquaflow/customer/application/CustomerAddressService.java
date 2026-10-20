package com.aquaflow.customer.application;

import com.aquaflow.customer.api.dto.CustomerAddressRequest;
import com.aquaflow.customer.api.dto.CustomerAddressResponse;
import com.aquaflow.customer.domain.Customer;
import com.aquaflow.customer.domain.CustomerAddress;
import com.aquaflow.customer.repository.CustomerAddressRepository;
import com.aquaflow.customer.repository.CustomerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class CustomerAddressService {

    private final CustomerAddressRepository customerAddressRepository;
    private final CustomerRepository customerRepository;

    public CustomerAddressService(
            CustomerAddressRepository customerAddressRepository,
            CustomerRepository customerRepository) {
        this.customerAddressRepository = customerAddressRepository;
        this.customerRepository = customerRepository;
    }

    @Transactional
    public Optional<CustomerAddressResponse> create(
            Long customerId,
            CustomerAddressRequest request) {

        return customerRepository.findById(customerId)
                .map(customer -> {
                    CustomerAddress address = new CustomerAddress(
                            customer,
                            request.recipientName(),
                            request.recipientPhone(),
                            request.addressLine(),
                            request.area());

                    CustomerAddress savedAddress =
                            customerAddressRepository.save(address);

                    return toResponse(savedAddress);
                });
    }

    public Optional<List<CustomerAddressResponse>> findAllByCustomerId(
            Long customerId) {

        if (!customerRepository.existsById(customerId)) {
            return Optional.empty();
        }

        List<CustomerAddressResponse> addresses =
                customerAddressRepository.findAllByCustomer_Id(customerId)
                        .stream()
                        .map(this::toResponse)
                        .toList();

        return Optional.of(addresses);
    }

    public Optional<CustomerAddressResponse> findById(
            Long customerId,
            Long addressId) {

        return customerAddressRepository
                .findByIdAndCustomer_Id(addressId, customerId)
                .map(this::toResponse);
    }

    @Transactional
    public Optional<CustomerAddressResponse> update(
            Long customerId,
            Long addressId,
            CustomerAddressRequest request) {

        return customerAddressRepository
                .findByIdAndCustomer_Id(addressId, customerId)
                .map(address -> {
                    address.updateDetails(
                            request.recipientName(),
                            request.recipientPhone(),
                            request.addressLine(),
                            request.area());

                    CustomerAddress savedAddress =
                            customerAddressRepository.save(address);

                    return toResponse(savedAddress);
                });
    }

    @Transactional
    public boolean delete(Long customerId, Long addressId) {
        Optional<CustomerAddress> address =
                customerAddressRepository
                        .findByIdAndCustomer_Id(addressId, customerId);

        if (address.isEmpty()) {
            return false;
        }

        customerAddressRepository.delete(address.get());
        return true;
    }

    private CustomerAddressResponse toResponse(
            CustomerAddress address) {

        Customer customer = address.getCustomer();

        return new CustomerAddressResponse(
                address.getId(),
                customer.getId(),
                address.getRecipientName(),
                address.getRecipientPhone(),
                address.getAddressLine(),
                address.getArea(),
                address.isDefault());
    }
}
