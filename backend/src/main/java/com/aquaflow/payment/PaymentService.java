package com.aquaflow.payment;

import com.aquaflow.payment.PaymentDtos.*;
import com.aquaflow.shared.api.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@Transactional(readOnly=true)
public class PaymentService {
    private final PaymentRepository repository;
    public PaymentService(PaymentRepository repository) { this.repository=repository; }
    public Payments payments(long id) { return new Payments(repository.balance(id),repository.receipts(id)); }
    public Receipt detail(long orderId,long id) { return repository.detail(orderId,id); }
    public List<Balance> balances() { return repository.balances(); }
    public PageResponse<CustomerBalance> customers(String q, PageRequestParams page) { return repository.customerBalances(SearchKeyword.of(q), page); }
    public List<Balance> receivables(long id) { return repository.receivables(id); }
    @Transactional
    public Receipt create(long id,long actor,Create input) {
        repository.lockOrder(id);
        var replay=repository.replay(id,actor,input);
        if (replay.isPresent()) return replay.get();
        var balance=repository.balance(id);
        if ("IN".equals(input.direction())) {
            if (List.of("PENDING","CANCELLED").contains(balance.status())) throw new ConflictException("Chỉ thu tiền đơn đã xác nhận và chưa hủy.");
            if (input.amount().compareTo(balance.due())>0) throw new ConflictException("Số tiền vượt quá số còn phải thu. Vui lòng tải lại đơn.");
        } else {
            // Đơn chưa hủy chỉ có số phải hoàn khi khách trả hàng sau giao làm giá trị đơn thấp hơn số đã thu.
            if (!"CANCELLED".equals(balance.status()) && balance.refundDue().signum() <= 0)
                throw new ConflictException("Chỉ hoàn tiền sau khi đơn đã hủy hoặc hoàn tất xử lý hàng hoàn.");
            if (input.note()==null) throw new BadRequestException("Nhập lý do hoàn tiền.");
            if (input.amount().compareTo(balance.refundDue())>0) throw new ConflictException("Số tiền vượt quá số phải hoàn.");
        }
        return repository.create(id,actor,input);
    }
}
