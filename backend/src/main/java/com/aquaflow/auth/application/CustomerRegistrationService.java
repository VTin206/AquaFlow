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

    public CustomerRegistrationService(UserRepository users, RoleRepository roles,
            CustomerRepository customers, PasswordEncoder passwords) {
        this.users = users; this.roles = roles; this.customers = customers; this.passwords = passwords;
    }

    @Transactional
    public UserResponse register(RegisterRequest request) {
        String email = request.email().toLowerCase(Locale.ROOT);
        String phone = request.phone().replaceFirst("^\\+?84", "0");
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new BadRequestException("Password must not exceed 72 UTF-8 bytes");
        if (users.findByEmailIgnoreCase(email).isPresent()) throw new ConflictException("Email already exists");
        // Never attach old orders to someone merely because they supplied the same phone number.
        if (customers.existsByPhoneAndActiveTrue(phone)
                || customers.existsByPhoneAndActiveTrue("+84" + phone.substring(1))
                || customers.existsByPhoneAndActiveTrue("84" + phone.substring(1)))
            throw new ConflictException("Phone already exists; contact the store to link your customer account");
        Role role = roles.findByCodeIgnoreCase("CUSTOMER")
                .orElseThrow(() -> new IllegalStateException("CUSTOMER role not configured"));
        User user = users.saveAndFlush(new User(role, request.fullName(), email, phone,
                passwords.encode(request.password()), UserStatus.ACTIVE));
        customers.saveAndFlush(new Customer(user.getId(), user.getFullName(), phone));
        return new UserResponse(user.getId(), user.getFullName(), user.getEmail(), user.getPhone(), "CUSTOMER", user.getStatus().name());
    }
}
