package com.aquaflow.customer.api;

import com.aquaflow.customer.api.dto.CustomerAddressRequest;
import com.aquaflow.customer.api.dto.CustomerAddressResponse;
import com.aquaflow.customer.application.CustomerAddressService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/sales/customers/{customerId}/addresses")
@Tag(
        name = "Customer Addresses",
        description = "Customer address management endpoints")
@SecurityRequirement(name = "bearerAuth")
public class CustomerAddressController {

    private final CustomerAddressService customerAddressService;

    public CustomerAddressController(
            CustomerAddressService customerAddressService) {
        this.customerAddressService = customerAddressService;
    }

    @PostMapping
    @Operation(summary = "Create an address for a customer")
    public ResponseEntity<CustomerAddressResponse> create(
            @PathVariable Long customerId,
            @Valid @RequestBody CustomerAddressRequest request) {

        Optional<CustomerAddressResponse> address =
                customerAddressService.create(customerId, request);

        if (address.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(address.get());
    }

    @GetMapping
    @Operation(summary = "Get all addresses of a customer")
    public ResponseEntity<List<CustomerAddressResponse>> findAll(
            @PathVariable Long customerId) {

        Optional<List<CustomerAddressResponse>> addresses =
                customerAddressService.findAllByCustomerId(customerId);

        if (addresses.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(addresses.get());
    }

    @GetMapping("/{addressId}")
    @Operation(summary = "Get a specific customer address")
    public ResponseEntity<CustomerAddressResponse> findById(
            @PathVariable Long customerId,
            @PathVariable Long addressId) {

        Optional<CustomerAddressResponse> address =
                customerAddressService.findById(customerId, addressId);

        if (address.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(address.get());
    }

    @PutMapping("/{addressId}")
    @Operation(summary = "Update a customer address")
    public ResponseEntity<CustomerAddressResponse> update(
            @PathVariable Long customerId,
            @PathVariable Long addressId,
            @Valid @RequestBody CustomerAddressRequest request) {

        Optional<CustomerAddressResponse> address =
                customerAddressService.update(
                        customerId,
                        addressId,
                        request);

        if (address.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(address.get());
    }

    @DeleteMapping("/{addressId}")
    @Operation(summary = "Delete a customer address")
    public ResponseEntity<Void> delete(
            @PathVariable Long customerId,
            @PathVariable Long addressId) {

        boolean deleted =
                customerAddressService.delete(customerId, addressId);

        if (!deleted) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.noContent().build();
    }
}
