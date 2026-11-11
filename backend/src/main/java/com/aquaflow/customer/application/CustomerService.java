package com.aquaflow.customer.application;

import com.aquaflow.customer.api.dto.CustomerRequest;
import com.aquaflow.customer.api.dto.CustomerResponse;
import com.aquaflow.customer.domain.Customer;
import com.aquaflow.customer.api.dto.CustomerPageResponse;
import com.aquaflow.customer.api.dto.CustomerSummary;
import com.aquaflow.customer.repository.CustomerQueryRepository;
import com.aquaflow.customer.repository.CustomerRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.PageRequestParams;
import com.aquaflow.shared.api.SearchKeyword;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class CustomerService {

    /** Các mức của bộ lọc "lâu chưa mua" trên trang Khách hàng. */
    public static final Set<Integer> IDLE_DAYS = Set.of(7, 14, 30);

    private final CustomerRepository customerRepository;
    private final CustomerAuditService customerAuditService;
    private final CustomerQueryRepository customerQueryRepository;
    private final Clock clock;

    public CustomerService(
            CustomerRepository customerRepository,
            CustomerAuditService customerAuditService,
            CustomerQueryRepository customerQueryRepository,
            Clock clock) {

        this.customerRepository = customerRepository;
        this.customerAuditService = customerAuditService;
        this.customerQueryRepository = customerQueryRepository;
        this.clock = clock;
    }

    /**
     * Trang Khách hàng: tìm, lọc "lâu chưa mua" và phân trang ở SQL.
     *
     * @param idle {@code null}/"all": không lọc; "7"/"14"/"30": chưa mua quá số ngày đó; "never": chưa mua lần nào
     * @param sort {@code null}: theo tên A → Z
     */
    public CustomerPageResponse search(String q, String idle, CustomerQueryRepository.Sort sort, PageRequestParams page) {
        CustomerQueryRepository.SummaryPage result = customerQueryRepository.search(
                SearchKeyword.of(q), idleFilter(idle), sort == null ? CustomerQueryRepository.Sort.DEFAULT : sort, page);
        return new CustomerPageResponse(
                result.items(), page.page(), page.size(), result.total(), page.totalPages(result.total()),
                customerQueryRepository.totals());
    }

    public Optional<CustomerSummary> findSummary(Long id) {
        return customerQueryRepository.findById(id);
    }

    private CustomerQueryRepository.IdleFilter idleFilter(String idle) {
        if (idle == null || idle.isBlank() || idle.equals("all")) return null;
        if (idle.equals("never")) return new CustomerQueryRepository.IdleFilter.Never();
        try {
            int days = Integer.parseInt(idle);
            if (IDLE_DAYS.contains(days)) {
                return new CustomerQueryRepository.IdleFilter.MoreThanDays(days, LocalDate.now(clock));
            }
        } catch (NumberFormatException ignored) {
            // Rơi xuống lỗi bên dưới.
        }
        throw new BadRequestException("idle must be one of all, 7, 14, 30, never");
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
