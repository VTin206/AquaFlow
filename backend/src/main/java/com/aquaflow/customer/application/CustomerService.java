package com.aquaflow.customer.application;

import com.aquaflow.customer.api.dto.CustomerRequest;
import com.aquaflow.customer.api.dto.CustomerResponse;
import com.aquaflow.customer.domain.Customer;
import com.aquaflow.customer.repository.CustomerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class CustomerService {

    private final CustomerRepository customerRepository;

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    @Transactional
    public CustomerResponse create(CustomerRequest request) {
        Customer customer = new Customer(
                request.fullName(),
                request.phone());

        Customer savedCustomer = customerRepository.save(customer);

        return toResponse(savedCustomer);
    }

    public List<CustomerResponse> findAll() {
        return customerRepository.findAllByActiveTrue()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public Optional<CustomerResponse> findById(Long id) {
        return customerRepository.findByIdAndActiveTrue(id)
                .map(this::toResponse);
    }

    @Transactional
    public Optional<CustomerResponse> update(
            Long id,
            CustomerRequest request) {

        return customerRepository.findByIdAndActiveTrue(id)
                .map(customer -> {
                    customer.updateDetails(
                            request.fullName(),
                            request.phone());

                    Customer savedCustomer = customerRepository.save(customer);

                    return toResponse(savedCustomer);
                });
    }

    @Transactional
    public boolean delete(Long id) {
        return customerRepository.findByIdAndActiveTrue(id)
                .map(customer -> {
                    customer.deactivate();
                    customerRepository.save(customer);
                    return true;
                })
                .orElse(false);
    }

    private CustomerResponse toResponse(Customer customer) {
        return new CustomerResponse(
                customer.getId(),
                customer.getFullName(),
                customer.getPhone(),
                customer.getCreatedAt());
    }
}
