package com.aquaflow.customer.application;

import com.aquaflow.customer.api.dto.CustomerRequest;
import com.aquaflow.customer.api.dto.CustomerResponse;
import com.aquaflow.customer.domain.Customer;
import com.aquaflow.customer.repository.CustomerRepository;
import com.aquaflow.shared.api.ConflictException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final CustomerAuditService customerAuditService;

    public CustomerService(
            CustomerRepository customerRepository,
            CustomerAuditService customerAuditService) {

        this.customerRepository = customerRepository;
        this.customerAuditService = customerAuditService;
    }

    @Transactional
    public CustomerResponse findOrCreateForUser(
            Long userId,
            String fullName,
            String phone) {

        Optional<Customer> existingCustomer =
                customerRepository.findByUserId(userId);

        if (existingCustomer.isPresent()) {
            Customer customer = existingCustomer.get();

            if (!customer.isActive()) {
                throw new ConflictException(
                        "Customer profile is inactive");
            }

            return toResponse(customer);
        }

        String normalizedPhone = normalizePhone(phone);

        if (normalizedPhone != null
                && customerRepository.existsByPhoneAndActiveTrue(
                        normalizedPhone)) {
            throw new ConflictException(
                    "An active customer profile already uses this phone. "
                            + "Please contact sales staff to link your account.");
        }

        Customer customer = new Customer(
                userId,
                fullName,
                normalizedPhone);

        return toResponse(customerRepository.save(customer));
    }

    public Optional<CustomerResponse> findActiveByUserId(Long userId) {
        return customerRepository.findByUserIdAndActiveTrue(userId)
                .map(this::toResponse);
    }

    @Transactional
    public CustomerResponse create(CustomerRequest request) {

        String phone = normalizePhone(request.phone());
        if (phone != null && customerRepository.existsByPhoneAndActiveTrue(phone)) {
            throw new ConflictException("Customer phone already exists");
        }

        Customer customer = new Customer(
                request.fullName(),
                phone);
        customer.updateProfile(request.customerType(), request.area(), request.note());

        Customer savedCustomer =
                customerRepository.save(customer);

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

                    String phone = normalizePhone(request.phone());
                    if (phone != null && customerRepository.existsByPhoneAndActiveTrueAndIdNot(phone, id)) {
                        throw new ConflictException("Customer phone already exists");
                    }

                    Map<String, Object> before =
                            snapshot(customer);

                    customer.updateDetails(
                            request.fullName(),
                            phone);
                    customer.updateProfile(request.customerType(), request.area(), request.note());

                    Customer savedCustomer =
                            customerRepository.save(customer);

                    Map<String, Object> after =
                            snapshot(savedCustomer);

                    customerAuditService.recordUpdate(
                            "CUSTOMER",
                            savedCustomer.getId(),
                            before,
                            after);

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

    private Map<String, Object> snapshot(Customer customer) {

        Map<String, Object> data = new LinkedHashMap<>();

        data.put("fullName", customer.getFullName());
        data.put("phone", customer.getPhone());

        return data;
    }

    private String normalizePhone(String phone) {
        if (phone == null || phone.isBlank()) {
            return null;
        }
        return phone.startsWith("+84") ? "0" + phone.substring(3) : phone;
    }

    private CustomerResponse toResponse(Customer customer) {

        return new CustomerResponse(
                customer.getId(),
                customer.getFullName(),
                customer.getPhone(),
                customer.getCreatedAt(),
                customer.getCustomerType(),
                customer.getArea(),
                customer.getNote());
    }
}
