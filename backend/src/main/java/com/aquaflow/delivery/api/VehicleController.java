package com.aquaflow.delivery.api;

import com.aquaflow.delivery.api.DeliveryDtos.VehicleRequest;
import com.aquaflow.delivery.api.DeliveryDtos.VehicleResponse;
import com.aquaflow.delivery.application.VehicleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** SecurityConfig: xem danh sách cho ADMIN và SALES_STAFF (xếp chuyến); thêm/sửa chỉ ADMIN. */
@RestController
@RequestMapping("/api/v1/delivery/vehicles")
@Tag(name = "Delivery vehicles")
@SecurityRequirement(name = "bearerAuth")
public class VehicleController {
    private final VehicleService service;

    public VehicleController(VehicleService service) { this.service = service; }

    @GetMapping
    @Operation(summary = "Vehicles with capacity (units) and the trip currently holding each one")
    public List<VehicleResponse> list() { return service.list(); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public VehicleResponse create(@Valid @RequestBody VehicleRequest request) { return service.create(request); }

    @PutMapping("/{id}")
    public VehicleResponse update(@PathVariable long id, @Valid @RequestBody VehicleRequest request) {
        return service.update(id, request);
    }
}
