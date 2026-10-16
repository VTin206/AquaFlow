package com.aquaflow.auth.repository;

import com.aquaflow.auth.domain.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, Long> {

    Optional<Role> findByCodeIgnoreCase(String code);
}
