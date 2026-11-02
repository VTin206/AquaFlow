package com.aquaflow.delivery.application.port;

import java.util.Collection;

public interface InventoryReturnPort {

    void receiveReturn(
            Long orderId,
            Collection<ReturnStockLine> lines,
            String reason,
            Long performedBy);
}
