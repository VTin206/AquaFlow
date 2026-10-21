package com.aquaflow.customer.repository;

import com.aquaflow.customer.domain.CustomerAddress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CustomerAddressRepository
        extends JpaRepository<CustomerAddress, Long> {

    List<CustomerAddress> findAllByCustomer_Id(Long customerId);

    Optional<CustomerAddress> findByIdAndCustomer_Id(
            Long id,
            Long customerId);
}
