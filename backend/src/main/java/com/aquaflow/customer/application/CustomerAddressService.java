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

        return customerRepository.findByIdAndActiveTrue(customerId)
                .map(customer -> {
                    List<CustomerAddress> existingAddresses =
                            customerAddressRepository
                                    .findAllByCustomer_Id(customerId);

                    boolean hasDefaultAddress = existingAddresses.stream()
                            .anyMatch(CustomerAddress::isDefault);

                    boolean shouldBeDefault =
                            existingAddresses.isEmpty()
                                    || !hasDefaultAddress
                                    || Boolean.TRUE.equals(request.isDefault());

                    if (shouldBeDefault) {
                        clearDefaultAddress(existingAddresses);
                    }

                    CustomerAddress address = new CustomerAddress(
                            customer,
                            request.recipientName(),
                            request.recipientPhone(),
                            request.addressLine(),
                            request.area());

                    address.setDefault(shouldBeDefault);

                    CustomerAddress savedAddress =
                            customerAddressRepository.save(address);

                    return toResponse(savedAddress);
                });
    }

    public Optional<List<CustomerAddressResponse>> findAllByCustomerId(
            Long customerId) {

        return customerRepository.findByIdAndActiveTrue(customerId)
                .map(customer ->
                        customerAddressRepository
                                .findAllByCustomer_Id(customerId)
                                .stream()
                                .map(this::toResponse)
                                .toList());
    }

    public Optional<CustomerAddressResponse> findById(
            Long customerId,
            Long addressId) {

        return customerRepository.findByIdAndActiveTrue(customerId)
                .flatMap(customer ->
                        customerAddressRepository
                                .findByIdAndCustomer_Id(addressId, customerId))
                .map(this::toResponse);
    }

    @Transactional
    public Optional<CustomerAddressResponse> update(
            Long customerId,
            Long addressId,
            CustomerAddressRequest request) {

        return customerRepository.findByIdAndActiveTrue(customerId)
                .flatMap(customer ->
                        customerAddressRepository
                                .findByIdAndCustomer_Id(addressId, customerId))
                .map(address -> {
                    address.updateDetails(
                            request.recipientName(),
                            request.recipientPhone(),
                            request.addressLine(),
                            request.area());

                    if (Boolean.TRUE.equals(request.isDefault())) {
                        List<CustomerAddress> existingAddresses =
                                customerAddressRepository
                                        .findAllByCustomer_Id(customerId);

                        clearDefaultAddress(existingAddresses);
                        address.setDefault(true);
                    } else if (Boolean.FALSE.equals(request.isDefault())
                            && address.isDefault()) {

                        List<CustomerAddress> replacementAddresses =
                                customerAddressRepository
                                        .findAllByCustomer_IdOrderByIdAsc(customerId)
                                        .stream()
                                        .filter(candidate ->
                                                !candidate.getId().equals(address.getId()))
                                        .toList();

                        if (!replacementAddresses.isEmpty()) {
                            address.setDefault(false);
                            customerAddressRepository.saveAndFlush(address);

                            CustomerAddress replacementDefault =
                                    replacementAddresses.get(0);

                            replacementDefault.setDefault(true);
                            customerAddressRepository.saveAndFlush(replacementDefault);
                        }
                    }

                    CustomerAddress savedAddress =
                            customerAddressRepository.save(address);

                    return toResponse(savedAddress);
                });
    }

    @Transactional
    public boolean delete(Long customerId, Long addressId) {
        return customerRepository.findByIdAndActiveTrue(customerId)
                .flatMap(customer ->
                        customerAddressRepository
                                .findByIdAndCustomer_Id(addressId, customerId))
                .map(address -> {
                    boolean wasDefault = address.isDefault();

                    customerAddressRepository.delete(address);

                    if (wasDefault) {
                        customerAddressRepository.flush();

                        List<CustomerAddress> remainingAddresses =
                                customerAddressRepository
                                        .findAllByCustomer_IdOrderByIdAsc(
                                                customerId);

                        if (!remainingAddresses.isEmpty()) {
                            CustomerAddress nextDefault =
                                    remainingAddresses.get(0);

                            nextDefault.setDefault(true);
                            customerAddressRepository.saveAndFlush(nextDefault);
                        }
                    }

                    return true;
                })
                .orElse(false);
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

    private void clearDefaultAddress(List<CustomerAddress> addresses) {
        for (CustomerAddress address : addresses) {
            if (address.isDefault()) {
                address.setDefault(false);
                customerAddressRepository.saveAndFlush(address);
            }
        }
    }
}
