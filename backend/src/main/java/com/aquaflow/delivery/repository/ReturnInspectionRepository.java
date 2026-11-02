package com.aquaflow.delivery.repository;

import com.aquaflow.delivery.domain.ReturnInspection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReturnInspectionRepository
        extends JpaRepository<ReturnInspection, Long> {

    boolean existsByAttemptId(Long attemptId);

    Optional<ReturnInspection> findByAttemptId(Long attemptId);
}
