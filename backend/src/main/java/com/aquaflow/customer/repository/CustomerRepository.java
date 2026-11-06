package com.aquaflow.customer.repository;

import com.aquaflow.customer.domain.Customer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CustomerRepository extends JpaRepository<Customer, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from Customer c where c.id = :id and c.active = true")
    Optional<Customer> lockActiveById(@org.springframework.data.repository.query.Param("id") Long id);

    List<Customer> findAllByActiveTrue();

    Optional<Customer> findByIdAndActiveTrue(Long id);

    Optional<Customer> findByUserIdAndActiveTrue(Long userId);

    Optional<Customer> findByUserId(Long userId);

    boolean existsByPhoneAndActiveTrue(String phone);

    boolean existsByPhoneAndActiveTrueAndIdNot(String phone, Long id);
}
