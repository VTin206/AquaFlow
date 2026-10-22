package com.aquaflow.auth.application;

import com.aquaflow.auth.domain.Role;
import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.domain.UserStatus;
import com.aquaflow.auth.repository.RoleRepository;
import com.aquaflow.auth.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Locale;

/** Creates the first administrator only when explicit bootstrap credentials are supplied. */
@Component
@ConditionalOnProperty(prefix = "app.bootstrap", name = "admin-email")
public class AdminBootstrap implements ApplicationRunner {

    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder passwordEncoder;
    private final TransactionTemplate transactions;
    private final String email;
    private final String password;
    private final String fullName;

    public AdminBootstrap(
            UserRepository users,
            RoleRepository roles,
            PasswordEncoder passwordEncoder,
            TransactionTemplate transactions,
            @Value("${app.bootstrap.admin-email}") String email,
            @Value("${app.bootstrap.admin-password:}") String password,
            @Value("${app.bootstrap.admin-name:Administrator}") String fullName) {
        this.users = users;
        this.roles = roles;
        this.passwordEncoder = passwordEncoder;
        this.transactions = transactions;
        this.email = email;
        this.password = password;
        this.fullName = fullName;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (email.isBlank() || password.length() < 12 || fullName.isBlank()) {
            throw new IllegalStateException("Bootstrap admin requires email, name and a password of at least 12 characters");
        }
        transactions.executeWithoutResult(status -> {
            if (users.count() != 0) {
                return;
            }
            Role admin = roles.findByCodeIgnoreCase("ADMIN")
                    .orElseGet(() -> roles.save(new Role("ADMIN", "Administrator")));
            users.save(new User(
                    admin,
                    fullName.trim(),
                    email.trim().toLowerCase(Locale.ROOT),
                    null,
                    passwordEncoder.encode(password),
                    UserStatus.ACTIVE));
        });
    }
}
