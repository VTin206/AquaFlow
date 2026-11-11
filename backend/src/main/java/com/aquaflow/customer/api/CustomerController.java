package com.aquaflow.customer.api;

import com.aquaflow.customer.api.dto.CustomerRequest;
import com.aquaflow.customer.api.dto.CustomerResponse;
import com.aquaflow.customer.application.CustomerService;
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

import com.aquaflow.customer.api.dto.CustomerPageResponse;
import com.aquaflow.customer.api.dto.CustomerSummary;
import com.aquaflow.customer.order.api.dto.OrderListItem;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.repository.CustomerQueryRepository;
import com.aquaflow.shared.api.PageRequestParams;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/sales/customers")
@Tag(name = "Customers", description = "Customer management endpoints")
@SecurityRequirement(name = "bearerAuth")
public class CustomerController {

    private final CustomerService customerService;
    private final OrderService orderService;

    public CustomerController(CustomerService customerService, OrderService orderService) {
        this.customerService = customerService;
        this.orderService = orderService;
    }

    @PostMapping
    @Operation(summary = "Create a customer")
    public ResponseEntity<CustomerResponse> create(
            @Valid @RequestBody CustomerRequest request) {

        CustomerResponse response = customerService.create(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @GetMapping
    @Operation(summary = "Search active customers",
            description = "q matches code KH-xxx, name, phone, area and latest delivery address, ignoring Vietnamese accents. "
                    + "idle: all | 7 | 14 | 30 (no order for more than N days) | never. "
                    + "sort: NAME (default) | ORDERS | LAST_ORDER | DEBT | BOTTLES, direction: ASC (default) | DESC. "
                    + "totals covers all active customers.")
    public CustomerPageResponse search(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String idle,
            @RequestParam(required = false) CustomerQueryRepository.SortField sort,
            @RequestParam(required = false) Sort.Direction direction) {
        CustomerQueryRepository.Sort order = sort == null ? null
                : new CustomerQueryRepository.Sort(sort, direction == Sort.Direction.DESC);
        return customerService.search(q, idle, order, PageRequestParams.of(page, size));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a customer with order count, latest order, debt and bottle balances")
    public ResponseEntity<CustomerSummary> findById(
            @PathVariable Long id) {

        return customerService.findSummary(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/orders")
    @Operation(summary = "Order history of a customer, newest first")
    public ResponseEntity<List<OrderListItem>> orders(@PathVariable Long id) {
        if (customerService.findSummary(id).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(orderService.customerOrders(id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a customer")
    public ResponseEntity<CustomerResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody CustomerRequest request) {

        Optional<CustomerResponse> customer =
                customerService.update(id, request);

        if (customer.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(customer.get());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a customer")
    public ResponseEntity<Void> delete(
            @PathVariable Long id) {

        boolean deleted = customerService.delete(id);

        if (!deleted) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.noContent().build();
    }
}
