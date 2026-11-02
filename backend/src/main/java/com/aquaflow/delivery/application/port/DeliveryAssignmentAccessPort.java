package com.aquaflow.delivery.application.port;

import java.util.List;

public interface DeliveryAssignmentAccessPort {

    DeliveryAssignmentSnapshot findActiveAssignment(
            Long assignmentId,
            Long viewerId,
            String viewerRole);

    DeliveryAssignmentSnapshot findAssignment(
            Long assignmentId,
            Long viewerId,
            String viewerRole);

    List<DeliveryAssignmentSnapshot> findAssignmentsByOrderId(
            Long orderId,
            Long viewerId,
            String viewerRole);

    DeliveryAssignmentSnapshot createAssignment(
            Long tripId,
            Long orderId);

    void deactivateAssignment(Long assignmentId);
}
