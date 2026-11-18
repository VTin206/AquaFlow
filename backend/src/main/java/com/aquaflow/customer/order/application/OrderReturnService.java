package com.aquaflow.customer.order.application;

import com.aquaflow.customer.order.api.dto.OrderReturnDtos.Create;
import com.aquaflow.customer.order.api.dto.OrderReturnDtos.Line;
import com.aquaflow.customer.order.api.dto.OrderReturnDtos.Response;
import com.aquaflow.customer.order.api.dto.OrderReturnDtos.Returnable;
import com.aquaflow.customer.order.api.dto.OrderReturnDtos.Summary;
import com.aquaflow.customer.order.repository.OrderReturnRepository;
import com.aquaflow.payment.PaymentDtos;
import com.aquaflow.payment.PaymentService;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Khách trả lại hàng đã nhận. Giá trị hàng trả (chia theo giảm giá của đơn) trừ vào số phải trả của đơn;
 * khách đã trả nhiều hơn phần còn lại thì hoàn tiền ngay trong cùng thao tác. Hàng còn bán được nhập lại
 * đúng lô khách đã nhận, hàng hỏng loại bỏ. Phí giao không hoàn. Ghi nhật ký qua ActivityAuditConfig.
 */
@Service
@Transactional(readOnly = true)
public class OrderReturnService {
    private static final Set<String> RETURNABLE_STATUSES = Set.of("DELIVERED", "COMPLETED");

    private final OrderReturnRepository repository;
    private final PaymentService payments;
    private final Clock clock;

    public OrderReturnService(OrderReturnRepository repository, PaymentService payments, Clock clock) {
        this.repository = repository;
        this.payments = payments;
        this.clock = clock;
    }

    public Summary summary(long orderId) {
        repository.requireOrder(orderId);
        return new Summary(repository.list(orderId), repository.returnable(orderId));
    }

    @Transactional
    public Response receive(Long orderId, long actorId, Create request) {
        var order = repository.lockOrder(orderId);
        String hash = fingerprint(orderId, actorId, request);
        var replay = repository.replay(request.requestId());
        if (replay.isPresent()) {
            if (replay.get().orderId() != orderId || !hash.equals(replay.get().hash()))
                throw new ConflictException("Mã yêu cầu đã dùng cho phiếu trả hàng khác. Hãy tải lại đơn.");
            return repository.get(replay.get().id());
        }
        if (!RETURNABLE_STATUSES.contains(order.status()))
            throw new ConflictException("Chỉ nhận trả hàng với đơn khách đã nhận.");

        Map<Long, Returnable> items = new HashMap<>();
        repository.returnable(orderId).forEach(item -> items.put(item.orderItemId(), item));
        Map<Long, Integer> quantities = new HashMap<>();
        for (Line line : request.lines()) {
            Returnable item = items.get(line.orderItemId());
            if (item == null) throw new BadRequestException("Sản phẩm trả không có trong đơn.");
            if (quantities.put(line.orderItemId(), line.quantity()) != null)
                throw new BadRequestException("Mỗi dòng hàng chỉ được chọn một lần.");
            if (line.quantity() > item.returnable())
                throw new ConflictException(item.productName() + ": chỉ còn " + item.returnable() + " có thể trả.");
        }

        long returnId = repository.create(orderId, request.reason(), request.restock(), actorId, request.requestId(), hash);
        LocalDate today = LocalDate.now(clock);
        String movementReason = "Khách trả hàng: " + request.reason();
        for (Line line : request.lines()) {
            repository.addItem(returnId, line.orderItemId(), line.quantity());
            if (request.restock()) restock(returnId, order, items.get(line.orderItemId()), line.quantity(), today, actorId, movementReason);
        }

        BigDecimal refundDue = repository.refundDue(orderId);
        if (refundDue.signum() > 0) {
            var refund = request.refund();
            if (refund == null)
                throw new BadRequestException("Cần hoàn " + money(refundDue) + " ₫ cho khách: chọn cách hoàn tiền.");
            if ("BANK_TRANSFER".equals(refund.method()) && refund.reference() == null)
                throw new BadRequestException("Nhập mã tham chiếu chuyển khoản hoàn tiền.");
            // Mã yêu cầu riêng cho phiếu hoàn, suy ra từ mã trả hàng để gửi lại không tạo phiếu thứ hai.
            UUID paymentRequest = UUID.nameUUIDFromBytes(("order-return:" + request.requestId()).getBytes(StandardCharsets.UTF_8));
            var receipt = payments.create(orderId, actorId, new PaymentDtos.Create(paymentRequest, refundDue, "OUT",
                    refund.method(), refund.reference(), truncate("Hoàn tiền trả hàng: " + request.reason(), 200)));
            repository.recordRefund(returnId, refundDue, receipt.id());
        } else {
            repository.refreshPaymentStatus(orderId);
        }
        return repository.get(returnId);
    }

    /** Nhập lại vào lô khách đã nhận, lô còn hạn và hạn xa nhất trước. Không đủ lô còn hạn thì từ chối cả phiếu. */
    private void restock(long returnId, OrderReturnRepository.OrderRow order, Returnable item, int quantity, LocalDate today,
                         long actorId, String reason) {
        int left = quantity;
        boolean expired = false;
        for (var batch : repository.receivedBatches(order.id(), order.fulfillmentType(), item.orderItemId())) {
            if (left == 0) break;
            if (batch.remaining() <= 0) continue;
            if (!batch.expiresOn().isAfter(today)) {
                expired = true;
                continue;
            }
            int taken = Math.min(left, batch.remaining());
            repository.restock(returnId, order.id(), item.orderItemId(), batch.batchId(), taken, actorId, reason);
            left -= taken;
        }
        if (left > 0) {
            throw new ConflictException(item.productName() + (expired
                    ? ": hàng trả thuộc lô đã hết hạn, không nhập lại kho được. Nhận trả mà không nhập lại kho."
                    : ": không tìm thấy lô khách đã nhận để nhập lại kho."));
        }
    }

    private static String fingerprint(long orderId, long actorId, Create request) {
        String value = orderId + "|" + actorId + "|" + request.reason() + "|" + request.restock() + "|"
                + request.lines().stream().sorted(Comparator.comparing(Line::orderItemId)).toList() + "|" + request.refund();
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static String money(BigDecimal amount) {
        return String.format(java.util.Locale.forLanguageTag("vi-VN"), "%,.0f", amount);
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
