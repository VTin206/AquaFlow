package com.aquaflow.customer.repository;

import com.aquaflow.customer.domain.Customer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    List<Customer> findAllByActiveTrue();

    Optional<Customer> findByIdAndActiveTrue(Long id);

    Optional<Customer> findByUserIdAndActiveTrue(Long userId);

    Optional<Customer> findByUserId(Long userId);

    boolean existsByPhoneAndActiveTrue(String phone);

    boolean existsByPhoneAndActiveTrueAndIdNot(String phone, Long id);
}
