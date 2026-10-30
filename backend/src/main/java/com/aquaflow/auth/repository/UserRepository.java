package com.aquaflow.auth.repository;

import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.domain.UserStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    @EntityGraph(attributePaths = "role")
    Optional<User> findByEmailIgnoreCase(String email);

    @EntityGraph(attributePaths = "role")
    Optional<User> findByIdAndStatus(Long id, UserStatus status);
}
