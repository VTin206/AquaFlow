package com.aquaflow.customer.order.application;

import com.aquaflow.customer.order.api.dto.PublicOrderResponse;
import com.aquaflow.customer.order.repository.OrderTrackingRepository;
import com.aquaflow.shared.api.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

/** Khách tự tra cứu đơn bằng mã đơn + số điện thoại, hoặc bằng liên kết riêng. */
@Service
public class OrderTrackingService {

    /** Cùng một thông báo cho mã sai và số điện thoại sai, để không dò được mã đơn nào tồn tại. */
    public static final String NOT_FOUND = "Không tìm thấy đơn. Kiểm tra lại mã đơn và số điện thoại.";
    public static final String LINK_NOT_FOUND = "Liên kết tra cứu không đúng hoặc đã hết hiệu lực.";

    private final OrderTrackingRepository repository;

    public OrderTrackingService(OrderTrackingRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public PublicOrderResponse lookup(String orderCode, String phone) {
        String wanted = normalizePhone(phone);
        var row = repository.findByOrderCode(orderCode.trim().toUpperCase(Locale.ROOT))
                .filter(order -> !wanted.isEmpty() && wanted.equals(normalizePhone(order.recipientPhone())))
                .orElseThrow(() -> new NotFoundException(NOT_FOUND));
        String token = row.trackingToken() != null
                ? row.trackingToken()
                : repository.issueTrackingToken(row.id(), TrackingTokens.generate());
        return toResponse(row, token);
    }

    @Transactional(readOnly = true)
    public PublicOrderResponse byToken(String token) {
        var row = repository.findByTrackingToken(token)
                .orElseThrow(() -> new NotFoundException(LINK_NOT_FOUND));
        return toResponse(row, row.trackingToken());
    }

    private PublicOrderResponse toResponse(OrderTrackingRepository.Row row, String token) {
        var items = repository.items(row.id()).stream()
                .map(item -> new PublicOrderResponse.Item(item.productId(), item.productName(), item.unit(),
                        item.quantity(), item.unitPrice(), item.lineTotal()))
                .toList();
        return new PublicOrderResponse(
                row.orderCode(), row.status(), row.fulfillmentType(), row.paymentStatus(), row.deliveryFailed(),
                row.recipientName(), maskPhone(row.recipientPhone()), row.deliveryAddress(), row.deliveryArea(),
                row.requestedDeliveryAt(), row.subtotal(), row.discountAmount(), row.deliveryFee(), row.total(),
                row.paid(), row.due(), row.createdAt(), row.confirmedAt(), row.deliveredAt(), row.cancelledAt(),
                token, items);
    }

    /** "+84 901-234-567", "84901234567" và "0901234567" là cùng một số. */
    static String normalizePhone(String phone) {
        if (phone == null) return "";
        String digits = phone.replaceAll("\\D", "");
        return digits.startsWith("84") && digits.length() >= 11 ? "0" + digits.substring(2) : digits;
    }

    static String maskPhone(String phone) {
        String digits = normalizePhone(phone);
        if (digits.length() < 7) return null;
        return digits.substring(0, 3) + "*".repeat(digits.length() - 6) + digits.substring(digits.length() - 3);
    }
}
