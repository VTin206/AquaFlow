package com.aquaflow.customer.application;

import com.aquaflow.customer.api.dto.CustomerAddressRequest;
import com.aquaflow.customer.api.dto.CustomerAddressResponse;
import com.aquaflow.customer.domain.Customer;
import com.aquaflow.customer.domain.CustomerAddress;
import com.aquaflow.customer.repository.CustomerAddressRepository;
import com.aquaflow.customer.repository.CustomerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class CustomerAddressService {

    private final CustomerAddressRepository customerAddressRepository;
    private final CustomerRepository customerRepository;
    private final CustomerAuditService customerAuditService;

    public CustomerAddressService(
            CustomerAddressRepository customerAddressRepository,
            CustomerRepository customerRepository,
            CustomerAuditService customerAuditService) {

        this.customerAddressRepository = customerAddressRepository;
        this.customerRepository = customerRepository;
        this.customerAuditService = customerAuditService;
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

                    boolean hasDefaultAddress =
                            existingAddresses.stream()
                                    .anyMatch(CustomerAddress::isDefault);

                    boolean shouldBeDefault =
                            existingAddresses.isEmpty()
                                    || !hasDefaultAddress
                                    || Boolean.TRUE.equals(
                                            request.isDefault());

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
                                .findByIdAndCustomer_Id(
                                        addressId,
                                        customerId))
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
                                .findByIdAndCustomer_Id(
                                        addressId,
                                        customerId))
                .map(address -> {

                    List<CustomerAddress> affectedAddresses =
                            new ArrayList<>(
                                    customerAddressRepository
                                            .findAllByCustomer_Id(
                                                    customerId));

                    List<CustomerAddress> replacementAddresses =
                            new ArrayList<>();

                    if (Boolean.FALSE.equals(request.isDefault())
                            && address.isDefault()) {

                        List<CustomerAddress> orderedAddresses =
                                customerAddressRepository
                                        .findAllByCustomer_IdOrderByIdAsc(
                                                customerId);

                        for (CustomerAddress candidate
                                : orderedAddresses) {

                            addOrReplaceById(
                                    affectedAddresses,
                                    candidate);
                        }

                        replacementAddresses =
                                orderedAddresses.stream()
                                        .filter(candidate ->
                                                !Objects.equals(
                                                        candidate.getId(),
                                                        address.getId()))
                                        .collect(
                                                java.util.stream.Collectors
                                                        .toCollection(
                                                                ArrayList::new));
                    }

                    addOrReplaceById(
                            affectedAddresses,
                            address);

                    Map<Long, Map<String, Object>> beforeSnapshots =
                            new LinkedHashMap<>();

                    for (CustomerAddress candidate
                            : affectedAddresses) {

                        beforeSnapshots.put(
                                candidate.getId(),
                                snapshot(candidate));
                    }

                    address.updateDetails(
                            request.recipientName(),
                            request.recipientPhone(),
                            request.addressLine(),
                            request.area());

                    if (Boolean.TRUE.equals(request.isDefault())) {
                        clearDefaultAddress(affectedAddresses);

                        address.setDefault(true);

                    } else if (Boolean.FALSE.equals(request.isDefault())
                            && address.isDefault()) {

                        if (!replacementAddresses.isEmpty()) {

                            address.setDefault(false);

                            customerAddressRepository
                                    .saveAndFlush(address);

                            CustomerAddress replacementDefault =
                                    replacementAddresses.get(0);

                            replacementDefault.setDefault(true);

                            customerAddressRepository
                                    .saveAndFlush(replacementDefault);
                        }
                    }

                    CustomerAddress savedAddress =
                            customerAddressRepository.save(address);

                    for (CustomerAddress candidate
                            : affectedAddresses) {

                        Map<String, Object> before =
                                beforeSnapshots.get(candidate.getId());

                        Map<String, Object> after =
                                snapshot(candidate);

                        if (before != null
                                && !before.equals(after)) {

                            customerAuditService.recordUpdate(
                                    "CUSTOMER_ADDRESS",
                                    candidate.getId(),
                                    before,
                                    after);
                        }
                    }

                    return toResponse(savedAddress);
                });
    }

    @Transactional
    public boolean delete(
            Long customerId,
            Long addressId) {

        return customerRepository.findByIdAndActiveTrue(customerId)
                .flatMap(customer ->
                        customerAddressRepository
                                .findByIdAndCustomer_Id(
                                        addressId,
                                        customerId))
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

                            customerAddressRepository
                                    .saveAndFlush(nextDefault);
                        }
                    }

                    return true;
                })
                .orElse(false);
    }

    private Map<String, Object> snapshot(
            CustomerAddress address) {

        Map<String, Object> data = new LinkedHashMap<>();

        data.put("recipientName", address.getRecipientName());
        data.put("recipientPhone", address.getRecipientPhone());
        data.put("addressLine", address.getAddressLine());
        data.put("area", address.getArea());
        data.put("isDefault", address.isDefault());

        return data;
    }

    private void addOrReplaceById(
            List<CustomerAddress> addresses,
            CustomerAddress target) {

        for (int i = 0; i < addresses.size(); i++) {

            if (Objects.equals(
                    addresses.get(i).getId(),
                    target.getId())) {

                addresses.set(i, target);
                return;
            }
        }

        addresses.add(target);
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

    private void clearDefaultAddress(
            List<CustomerAddress> addresses) {

        for (CustomerAddress address : addresses) {

            if (address.isDefault()) {

                address.setDefault(false);

                customerAddressRepository
                        .saveAndFlush(address);
            }
        }
    }
}
