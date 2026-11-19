package com.aquaflow.auth.application;

import com.aquaflow.auth.api.dto.RegisterRequest;
import com.aquaflow.auth.api.dto.UserResponse;
import com.aquaflow.auth.domain.*;
import com.aquaflow.auth.repository.*;
import com.aquaflow.customer.domain.Customer;
import com.aquaflow.customer.repository.CustomerRepository;
import com.aquaflow.shared.api.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Service
public class CustomerRegistrationService {
    private final UserRepository users;
    private final RoleRepository roles;
    private final CustomerRepository customers;
    private final PasswordEncoder passwords;
    private final RegistrationVerificationService verification;

    public CustomerRegistrationService(UserRepository users, RoleRepository roles,
            CustomerRepository customers, PasswordEncoder passwords, RegistrationVerificationService verification) {
        this.users = users; this.roles = roles; this.customers = customers; this.passwords = passwords;
        this.verification = verification;
    }

    /** Gửi mã xác nhận tới email sắp đăng ký; báo trùng email/số điện thoại ngay, trước khi gửi mail. */
    @Transactional
    public RegistrationVerificationService.Sent sendVerificationCode(String rawEmail, String rawPhone) {
        String email = email(rawEmail);
        ensureAvailable(email, phone(rawPhone));
        return verification.send(email);
    }

    /**
     * Mọi {@link BadRequestException} ở đây ném ra trước khi ghi tài khoản, nên không rollback để giữ lại
     * lần nhập sai mã (giới hạn {@link RegistrationVerificationService#MAX_ATTEMPTS} lần).
     */
    @Transactional(noRollbackFor = BadRequestException.class)
    public UserResponse register(RegisterRequest request) {
        String email = email(request.email());
        String phone = phone(request.phone());
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new BadRequestException("Password must not exceed 72 UTF-8 bytes");
        ensureAvailable(email, phone);
        verification.consume(email, request.verificationCode());
        Role role = roles.findByCodeIgnoreCase("CUSTOMER")
                .orElseThrow(() -> new IllegalStateException("CUSTOMER role not configured"));
        User user = users.saveAndFlush(new User(role, request.fullName(), email, phone,
                passwords.encode(request.password()), UserStatus.ACTIVE));
        customers.saveAndFlush(new Customer(user.getId(), user.getFullName(), phone));
        return new UserResponse(user.getId(), user.getFullName(), user.getEmail(), user.getPhone(), "CUSTOMER", user.getStatus().name());
    }

    private void ensureAvailable(String email, String phone) {
        if (users.findByEmailIgnoreCase(email).isPresent()) throw new ConflictException("Email already exists");
        // Never attach old orders to someone merely because they supplied the same phone number.
        if (customers.existsByPhoneAndActiveTrue(phone)
                || customers.existsByPhoneAndActiveTrue("+84" + phone.substring(1))
                || customers.existsByPhoneAndActiveTrue("84" + phone.substring(1)))
            throw new ConflictException("Phone already exists; contact the store to link your customer account");
    }

    private static String email(String email) { return email.trim().toLowerCase(Locale.ROOT); }

    private static String phone(String phone) { return phone.trim().replaceFirst("^\\+?84", "0"); }
}
