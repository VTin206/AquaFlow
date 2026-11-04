package com.aquaflow.delivery.api;

import com.aquaflow.delivery.application.DeliveryService;
import com.aquaflow.delivery.api.DeliveryDtos.*;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/delivery")
@Tag(name = "Delivery options")
@SecurityRequirement(name = "bearerAuth")
public class DeliveryOptionsController {
    private final DeliveryService service;
    public DeliveryOptionsController(DeliveryService service) { this.service = service; }

    // SecurityConfig restricts these two resources to ADMIN and SALES_STAFF.
    @GetMapping("/drivers")
    public List<DriverResponse> drivers() { return service.drivers(true); }

    @GetMapping("/available-orders")
    public List<AvailableOrderResponse> orders() { return service.availableOrders(true); }
}
