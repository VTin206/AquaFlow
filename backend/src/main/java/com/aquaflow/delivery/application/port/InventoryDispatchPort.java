package com.aquaflow.delivery.application.port;

import java.util.Collection;
import java.util.List;

public interface InventoryDispatchPort {

    List<DispatchedStockLine> dispatch(
            Long orderId,
            Collection<Long> orderItemIds,
            Long performedBy);
}
