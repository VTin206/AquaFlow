package com.aquaflow.auth.application;

import com.aquaflow.auth.domain.Role;
import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.domain.UserStatus;
import com.aquaflow.auth.repository.RoleRepository;
import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.customer.domain.Customer;
import com.aquaflow.customer.repository.CustomerRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Optional local-only seed for one account per role. Credentials are supplied via environment variables
 * and are never committed or changed when an account already exists.
 */
@Component
@Profile("local")
@ConditionalOnProperty(prefix = "app.bootstrap", name = "local-accounts", havingValue = "true")
public class LocalAccountBootstrap implements ApplicationRunner {

    private final UserRepository users;
    private final RoleRepository roles;
    private final CustomerRepository customers;
    private final PasswordEncoder passwords;
    private final TransactionTemplate transactions;
    private final Environment environment;

    public LocalAccountBootstrap(
            UserRepository users,
            RoleRepository roles,
            CustomerRepository customers,
            PasswordEncoder passwords,
            TransactionTemplate transactions,
            Environment environment) {
        this.users = users;
        this.roles = roles;
        this.customers = customers;
        this.passwords = passwords;
        this.transactions = transactions;
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) {
        transactions.executeWithoutResult(status -> {
            seed("admin", "ADMIN", "AquaFlow Admin", null);
            seed("sales", "SALES_STAFF", "AquaFlow Sales", null);
            seed("driver", "DELIVERY_STAFF", "AquaFlow Driver", null);
            seed("customer", "CUSTOMER", "AquaFlow Customer", "0900000004");
        });
    }

    private void seed(String key, String roleCode, String defaultName, String defaultPhone) {
        String email = required("app.bootstrap." + key + "-email").toLowerCase(Locale.ROOT);
        String password = required("app.bootstrap." + key + "-password");
        if (password.getBytes(StandardCharsets.UTF_8).length < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new IllegalStateException("Local bootstrap password for " + key + " must be 12–72 UTF-8 bytes");

        var existing = users.findByEmailIgnoreCase(email);
        if (existing.isPresent()) {
            if (!roleCode.equals(existing.get().getRole().getCode()))
                throw new IllegalStateException("Existing account has a different role: " + email);
            if ("CUSTOMER".equals(roleCode) && customers.findByUserId(existing.get().getId()).isEmpty())
                customers.saveAndFlush(new Customer(existing.get().getId(), existing.get().getFullName(), existing.get().getPhone()));
            return;
        }

        Role role = roles.findByCodeIgnoreCase(roleCode)
                .orElseThrow(() -> new IllegalStateException("Role not configured: " + roleCode));
        String name = environment.getProperty("app.bootstrap." + key + "-name", defaultName).trim();
        String phone = environment.getProperty("app.bootstrap." + key + "-phone", defaultPhone);
        User user = users.saveAndFlush(new User(role, name, email, clean(phone), passwords.encode(password), UserStatus.ACTIVE));
        if ("CUSTOMER".equals(roleCode)) customers.saveAndFlush(new Customer(user.getId(), name, clean(phone)));
    }

    private String required(String property) {
        String value = environment.getProperty(property);
        if (value == null || value.isBlank()) throw new IllegalStateException("Missing local bootstrap property: " + property);
        return value.trim();
    }

    private static String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
