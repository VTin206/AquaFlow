package com.aquaflow.payment;

import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.payment.PaymentDtos.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.ResponseEntity;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/sales")
public class PaymentController {
    private final PaymentService service;
    public PaymentController(PaymentService service) { this.service=service; }
    @GetMapping("/orders/{id}/payments") public Payments payments(@PathVariable long id) { return service.payments(id); }
    @GetMapping("/orders/{orderId}/payments/{id}") public Receipt detail(@PathVariable long orderId,@PathVariable long id) { return service.detail(orderId,id); }
    @PostMapping("/orders/{id}/payments") public ResponseEntity<Receipt> create(@PathVariable long id,@Valid @RequestBody Create input,@AuthenticationPrincipal AuthUserDetails user) {
        var receipt=service.create(id,user.user().getId(),input);
        return ResponseEntity.created(URI.create("/api/v1/sales/orders/"+id+"/payments/"+receipt.id())).body(receipt);
    }
    @GetMapping("/order-balances") public List<Balance> balances() { return service.balances(); }
    @GetMapping("/customer-balances") public List<CustomerBalance> customers() { return service.customers(); }
    @GetMapping("/customers/{id}/receivables") public List<Balance> receivables(@PathVariable long id) { return service.receivables(id); }
}
