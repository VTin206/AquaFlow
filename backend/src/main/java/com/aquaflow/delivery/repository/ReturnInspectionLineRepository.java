package com.aquaflow.delivery.repository;

import com.aquaflow.delivery.domain.ReturnInspectionLine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReturnInspectionLineRepository
        extends JpaRepository<ReturnInspectionLine, Long> {

    List<ReturnInspectionLine> findAllByInspectionIdOrderByIdAsc(
            Long inspectionId);
}
