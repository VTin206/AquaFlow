package com.aquaflow.delivery.application;

import com.aquaflow.delivery.api.DeliveryDtos.VehicleRequest;
import com.aquaflow.delivery.api.DeliveryDtos.VehicleResponse;
import com.aquaflow.delivery.repository.VehicleRepository;
import com.aquaflow.shared.api.ConflictException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Danh mục xe giao hàng: biển số, tên gọi và sức chở (kiện). */
@Service
@Transactional(readOnly = true)
public class VehicleService {
    private final VehicleRepository vehicles;

    public VehicleService(VehicleRepository vehicles) { this.vehicles = vehicles; }

    public List<VehicleResponse> list() {
        var busy = vehicles.busyTripByVehicle();
        return vehicles.list().stream().map(v -> new VehicleResponse(v.id(), v.plate(), v.name(), v.capacity(), v.active(),
                busy.get(v.id()))).toList();
    }

    @Transactional
    public VehicleResponse create(VehicleRequest request) {
        String plate = request.plate().trim();
        if (vehicles.plateTaken(plate, null)) throw new ConflictException("Biển số " + plate + " đã có trong danh sách xe");
        long id = vehicles.create(plate, blankToNull(request.name()), request.capacity());
        return view(id);
    }

    @Transactional
    public VehicleResponse update(long id, VehicleRequest request) {
        var current = vehicles.lock(id);
        String plate = request.plate().trim();
        if (vehicles.plateTaken(plate, id)) throw new ConflictException("Biển số " + plate + " đã có trong danh sách xe");
        boolean active = request.active() == null ? current.active() : request.active();
        if (!active && current.active())
            vehicles.vehicleBusy(id, null).ifPresent(busy -> {
                throw new ConflictException("Xe " + current.plate() + " đang ở chuyến #" + busy.tripId() + ", chưa ngừng sử dụng được");
            });
        vehicles.update(id, plate, blankToNull(request.name()), request.capacity(), active);
        return view(id);
    }

    private VehicleResponse view(long id) {
        var v = vehicles.find(id).orElseThrow();
        return new VehicleResponse(v.id(), v.plate(), v.name(), v.capacity(), v.active(),
                vehicles.vehicleBusy(id, null).map(VehicleRepository.BusyTrip::tripId).orElse(null));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
