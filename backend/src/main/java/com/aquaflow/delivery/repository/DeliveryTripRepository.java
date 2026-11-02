package com.aquaflow.delivery.repository;

import com.aquaflow.delivery.domain.DeliveryTrip;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DeliveryTripRepository extends JpaRepository<DeliveryTrip, Long> {

    @EntityGraph(attributePaths = {"driver", "createdBy"})
    List<DeliveryTrip> findAllByOrderByCreatedAtDescIdDesc();

    @EntityGraph(attributePaths = {"driver", "createdBy"})
    List<DeliveryTrip> findAllByDriver_IdOrderByCreatedAtDescIdDesc(Long driverId);

    @EntityGraph(attributePaths = {"driver", "createdBy"})
    Optional<DeliveryTrip> findWithPeopleById(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from DeliveryTrip t where t.id = :id")
    Optional<DeliveryTrip> findForUpdateById(@Param("id") Long id);
}
