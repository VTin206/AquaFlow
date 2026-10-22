package com.aquaflow.auth.application;

import com.aquaflow.auth.domain.Role;
import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.repository.RoleRepository;
import com.aquaflow.auth.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Optional;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminBootstrapTest {

    @Test
    void createsFirstAdminWithEncodedPassword() {
        UserRepository users = mock(UserRepository.class);
        RoleRepository roles = mock(RoleRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        TransactionTemplate transactions = mock(TransactionTemplate.class);
        doAnswer(invocation -> {
            Consumer<TransactionStatus> callback = invocation.getArgument(0);
            callback.accept(mock(TransactionStatus.class));
            return null;
        }).when(transactions).executeWithoutResult(any());
        when(roles.findByCodeIgnoreCase("ADMIN")).thenReturn(Optional.empty());
        when(roles.save(any(Role.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(encoder.encode("strong-password-123")).thenReturn("bcrypt-hash");

        new AdminBootstrap(users, roles, encoder, transactions,
                " ADMIN@example.com ", "strong-password-123", "Administrator").run(mock(ApplicationArguments.class));

        ArgumentCaptor<User> created = ArgumentCaptor.forClass(User.class);
        verify(users).save(created.capture());
        assertThat(created.getValue().getEmail()).isEqualTo("admin@example.com");
        assertThat(created.getValue().getPasswordHash()).isEqualTo("bcrypt-hash");
        assertThat(created.getValue().getRole().getCode()).isEqualTo("ADMIN");
    }

    @Test
    void rejectsShortBootstrapPassword() {
        UserRepository users = mock(UserRepository.class);
        TransactionTemplate transactions = mock(TransactionTemplate.class);
        AdminBootstrap bootstrap = new AdminBootstrap(users, mock(RoleRepository.class),
                mock(PasswordEncoder.class), transactions, "admin@example.com", "short", "Administrator");

        assertThatThrownBy(() -> bootstrap.run(mock(ApplicationArguments.class)))
                .isInstanceOf(IllegalStateException.class);
        verify(users, never()).save(any());
    }
}
