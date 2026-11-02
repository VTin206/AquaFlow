package com.aquaflow.delivery.application;

import com.aquaflow.customer.order.api.dto.OrderResponse;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.delivery.api.dto.ReturnInspectionCreateRequest;
import com.aquaflow.delivery.api.dto.ReturnInspectionResponse;
import com.aquaflow.delivery.application.port.DeliveryAssignmentAccessPort;
import com.aquaflow.delivery.application.port.DeliveryAssignmentSnapshot;
import com.aquaflow.delivery.application.port.InventoryReturnPort;
import com.aquaflow.delivery.application.port.ReturnStockLine;
import com.aquaflow.delivery.domain.DeliveryAttempt;
import com.aquaflow.delivery.domain.DeliveryAttemptOutcome;
import com.aquaflow.delivery.domain.DeliveryLoadItem;
import com.aquaflow.delivery.domain.ReturnInspection;
import com.aquaflow.delivery.domain.ReturnInspectionLine;
import com.aquaflow.delivery.repository.DeliveryAttemptRepository;
import com.aquaflow.delivery.repository.DeliveryLoadItemRepository;
import com.aquaflow.delivery.repository.ReturnInspectionLineRepository;
import com.aquaflow.delivery.repository.ReturnInspectionRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ReturnInspectionWorkflowService {

    private final DeliveryAttemptRepository deliveryAttemptRepository;
    private final ReturnInspectionRepository returnInspectionRepository;
    private final ReturnInspectionLineRepository returnInspectionLineRepository;
    private final DeliveryLoadItemRepository deliveryLoadItemRepository;
    private final DeliveryAssignmentAccessPort assignmentAccessPort;
    private final InventoryReturnPort inventoryReturnPort;
    private final OrderService orderService;

    public ReturnInspectionWorkflowService(
            DeliveryAttemptRepository deliveryAttemptRepository,
            ReturnInspectionRepository returnInspectionRepository,
            ReturnInspectionLineRepository returnInspectionLineRepository,
            DeliveryLoadItemRepository deliveryLoadItemRepository,
            DeliveryAssignmentAccessPort assignmentAccessPort,
            InventoryReturnPort inventoryReturnPort,
            OrderService orderService) {

        this.deliveryAttemptRepository = deliveryAttemptRepository;
        this.returnInspectionRepository = returnInspectionRepository;
        this.returnInspectionLineRepository = returnInspectionLineRepository;
        this.deliveryLoadItemRepository = deliveryLoadItemRepository;
        this.assignmentAccessPort = assignmentAccessPort;
        this.inventoryReturnPort = inventoryReturnPort;
        this.orderService = orderService;
    }

    @Transactional
    public ReturnInspectionResponse inspectReturn(
            Long attemptId,
            Long viewerId,
            String viewerRole,
            ReturnInspectionCreateRequest request) {

        validateInput(attemptId, viewerId, viewerRole, request);

        DeliveryAttempt attempt = deliveryAttemptRepository
                .findById(attemptId)
                .orElseThrow(() -> new NotFoundException(
                        "Delivery attempt not found: " + attemptId));

        if (attempt.getOutcome() != DeliveryAttemptOutcome.FAILED) {
            throw new ConflictException(
                    "Return inspection is only allowed for failed delivery attempts");
        }

        if (returnInspectionRepository.existsByAttemptId(attemptId)) {
            throw new ConflictException(
                    "Return inspection already exists for this attempt");
        }

        Long assignmentId = attempt.getAssignmentId();

        DeliveryAssignmentSnapshot assignment =
                assignmentAccessPort.findActiveAssignment(
                        assignmentId,
                        viewerId,
                        viewerRole);

        if (assignment == null || !assignment.active()) {
            throw new NotFoundException(
                    "Active delivery assignment not found");
        }

        if (assignment.fulfillmentType() != FulfillmentType.DELIVERY
                || assignment.orderId() == null) {
            throw new ConflictException(
                    "Invalid delivery assignment");
        }

        OrderResponse order = orderService
                .findForUpdateById(assignment.orderId())
                .orElseThrow(() -> new NotFoundException(
                        "Order not found: " + assignment.orderId()));

        if (order.fulfillmentType() != FulfillmentType.DELIVERY
                || order.status() != OrderStatus.OUT_FOR_DELIVERY) {
            throw new ConflictException(
                    "Order must be OUT_FOR_DELIVERY during return inspection");
        }

        List<DeliveryLoadItem> loadItems =
                deliveryLoadItemRepository
                        .findAllByAssignmentIdOrderByOrderItemIdAscBatchIdAsc(
                                assignmentId);

        if (loadItems.isEmpty()) {
            throw new ConflictException(
                    "No dispatched load items were found");
        }

        Map<Long, DeliveryLoadItem> loadItemsById = new HashMap<>();

        for (DeliveryLoadItem item : loadItems) {
            if (item == null || item.getId() == null) {
                throw new IllegalStateException(
                        "Invalid delivery load item data");
            }

            loadItemsById.put(item.getId(), item);
        }

        if (loadItemsById.size() != loadItems.size()) {
            throw new IllegalStateException(
                    "Duplicate delivery load item IDs were found");
        }

        validateInspectionLines(request.lines(), loadItemsById);

        ReturnInspection inspection =
                returnInspectionRepository.saveAndFlush(
                        new ReturnInspection(
                                attemptId,
                                viewerId,
                                request.note()));

        List<ReturnStockLine> stockLines = new ArrayList<>();
        List<ReturnInspectionLine> inspectionLines = new ArrayList<>();

        for (ReturnInspectionCreateRequest.Line line : request.lines()) {

            DeliveryLoadItem item =
                    loadItemsById.get(line.loadItemId());

            int resellable = line.quantityResellable();
            int damaged = line.quantityDamaged();

            stockLines.add(new ReturnStockLine(
                    item.getOrderItemId(),
                    item.getBatchId(),
                    resellable,
                    damaged));

            inspectionLines.add(new ReturnInspectionLine(
                    inspection.getId(),
                    item.getId(),
                    resellable,
                    damaged,
                    line.note()));

            item.recordReturned(resellable + damaged);
        }

        inventoryReturnPort.receiveReturn(
                order.id(),
                stockLines,
                request.note(),
                viewerId);

        List<ReturnInspectionLine> savedLines =
                returnInspectionLineRepository.saveAll(inspectionLines);

        deliveryLoadItemRepository.saveAll(loadItems);

        assignmentAccessPort.deactivateAssignment(assignmentId);

        return toResponse(
                inspection,
                assignmentId,
                savedLines);
    }

    private void validateInput(
            Long attemptId,
            Long viewerId,
            String viewerRole,
            ReturnInspectionCreateRequest request) {

        if (attemptId == null || attemptId <= 0) {
            throw new BadRequestException(
                    "Attempt ID must be positive");
        }

        if (viewerId == null || viewerId <= 0) {
            throw new BadRequestException(
                    "Inspector ID must be positive");
        }

        if (viewerRole == null || viewerRole.isBlank()) {
            throw new BadRequestException(
                    "Viewer role is required");
        }

        if (request == null
                || request.lines() == null
                || request.lines().isEmpty()) {
            throw new BadRequestException(
                    "Return inspection lines are required");
        }
    }

    private void validateInspectionLines(
            List<ReturnInspectionCreateRequest.Line> requestLines,
            Map<Long, DeliveryLoadItem> loadItemsById) {

        if (requestLines.size() != loadItemsById.size()) {
            throw new BadRequestException(
                    "Every dispatched load item must be inspected exactly once");
        }

        Set<Long> receivedIds = new HashSet<>();

        for (ReturnInspectionCreateRequest.Line line : requestLines) {

            if (line == null
                    || line.loadItemId() == null
                    || line.quantityResellable() == null
                    || line.quantityDamaged() == null) {
                throw new BadRequestException(
                        "Return inspection line contains missing fields");
            }

            Long loadItemId = line.loadItemId();

            if (!receivedIds.add(loadItemId)) {
                throw new BadRequestException(
                        "Duplicate load item ID: " + loadItemId);
            }

            DeliveryLoadItem item = loadItemsById.get(loadItemId);

            if (item == null) {
                throw new BadRequestException(
                        "Load item does not belong to this assignment: "
                                + loadItemId);
            }

            int resellable = line.quantityResellable();
            int damaged = line.quantityDamaged();

            if (resellable < 0 || damaged < 0) {
                throw new BadRequestException(
                        "Inspection quantities cannot be negative");
            }

            int inspected = resellable + damaged;
            int remaining = item.getRemainingQuantity();

            if (remaining <= 0 || inspected != remaining) {
                throw new ConflictException(
                        "Inspected quantity must equal remaining quantity "
                                + "for load item " + loadItemId);
            }
        }
    }

    private ReturnInspectionResponse toResponse(
            ReturnInspection inspection,
            Long assignmentId,
            List<ReturnInspectionLine> lines) {

        List<ReturnInspectionResponse.Line> responseLines =
                lines.stream()
                        .map(line -> new ReturnInspectionResponse.Line(
                                line.getId(),
                                line.getLoadItemId(),
                                line.getQuantityResellable(),
                                line.getQuantityDamaged(),
                                line.getNote()))
                        .toList();

        return new ReturnInspectionResponse(
                inspection.getId(),
                inspection.getAttemptId(),
                assignmentId,
                inspection.getInspectedBy(),
                inspection.getInspectedAt(),
                inspection.getNote(),
                responseLines);
    }
}
