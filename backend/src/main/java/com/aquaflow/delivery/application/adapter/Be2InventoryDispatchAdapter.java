package com.aquaflow.delivery.application.adapter;

import com.aquaflow.delivery.application.port.DispatchedStockLine;
import com.aquaflow.delivery.application.port.InventoryDispatchPort;
import com.aquaflow.delivery.application.port.InventoryReturnPort;
import com.aquaflow.delivery.application.port.ReturnStockLine;
import com.aquaflow.inventory.application.DispatchedLine;
import com.aquaflow.inventory.application.InventoryDispatchService;
import com.aquaflow.inventory.application.ReturnLine;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;

@Component
public class Be2InventoryDispatchAdapter
        implements InventoryDispatchPort, InventoryReturnPort {

    private final InventoryDispatchService inventoryDispatchService;

    public Be2InventoryDispatchAdapter(
            InventoryDispatchService inventoryDispatchService) {

        this.inventoryDispatchService = inventoryDispatchService;
    }

    @Override
    public List<DispatchedStockLine> dispatch(
            Long orderId,
            Collection<Long> orderItemIds,
            Long performedBy) {

        List<DispatchedLine> dispatchedLines =
                inventoryDispatchService.dispatch(
                        orderId,
                        orderItemIds,
                        performedBy);

        return dispatchedLines.stream()
                .map(this::toDispatchedStockLine)
                .toList();
    }

    @Override
    public void receiveReturn(
            Long orderId,
            Collection<ReturnStockLine> lines,
            String reason,
            Long performedBy) {

        List<ReturnLine> be2Lines = lines.stream()
                .map(line -> new ReturnLine(
                        line.orderItemId(),
                        line.batchId(),
                        line.resellableQuantity(),
                        line.damagedQuantity()))
                .toList();

        inventoryDispatchService.receiveReturn(
                orderId,
                be2Lines,
                reason,
                performedBy);
    }

    private DispatchedStockLine toDispatchedStockLine(
            DispatchedLine line) {

        return new DispatchedStockLine(
                line.reservationId(),
                line.orderItemId(),
                line.productId(),
                line.batchId(),
                line.lotCode(),
                line.expiresOn(),
                line.quantityDispatched(),
                line.quantityReturned(),
                line.quantityDamaged(),
                line.quantityUnreturned());
    }
}
