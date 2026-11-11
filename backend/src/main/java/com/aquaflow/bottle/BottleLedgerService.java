package com.aquaflow.bottle;

import com.aquaflow.bottle.BottleLedgerDtos.*;
import com.aquaflow.shared.api.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.*;
import java.util.*;

@Service
@Transactional(readOnly=true)
public class BottleLedgerService {
    private final BottleLedgerRepository repository;
    public BottleLedgerService(BottleLedgerRepository repository) { this.repository=repository; }
    public PageResponse<Balance> balances(String q, PageRequestParams page) { return repository.balances(SearchKeyword.of(q),page); }
    public Ledger ledger(long customer) { return new Ledger(repository.balance(customer),repository.types(customer),repository.entries(customer)); }
    public Entry detail(long customer,UUID id) { return repository.detail(customer,id); }
    @Transactional
    public Entry create(long customer,long actor,boolean admin,Create input) {
        if(!admin && Set.of("LOSS","REFUND").contains(input.kind())) throw new org.springframework.security.access.AccessDeniedException("Chỉ chủ cửa hàng được hoàn cọc hoặc ghi nhận mất/vỡ");
        repository.lockCustomer(customer);
        var replay=repository.replay(customer,actor,input);
        if(replay!=null) return replay;
        var balance=repository.balance(customer);
        int bottles=0;
        BigDecimal deposit=BigDecimal.ZERO,liability=BigDecimal.ZERO;
        switch(input.kind()) {
            case "GIVE", "RECEIVE", "LOSS" -> {
                if(input.bottleTypeId()==null || input.quantity()==null || input.quantity()<=0 || input.amount()!=null)
                    throw new BadRequestException("Chọn loại vỏ và số lượng nguyên dương; không nhập tiền cho giao dịch vỏ");
                var type=repository.types(customer).stream().filter(t->t.bottleTypeId()==input.bottleTypeId()).findFirst().orElseThrow(()->new NotFoundException("Không tìm thấy loại vỏ"));
                if(Set.of("GIVE","LOSS").contains(input.kind()) && input.note()==null) throw new BadRequestException("Nhập lý do giao vỏ hoặc mất/vỡ");
                if(input.kind().equals("GIVE")) {
                    if(!balance.active() || !type.active()) throw new ConflictException("Khách hàng hoặc loại vỏ đã ngừng hoạt động");
                    bottles=input.quantity();
                    liability=type.unitAmount().multiply(BigDecimal.valueOf(bottles));
                } else {
                    if(input.quantity()>type.held()) throw new ConflictException("Số vỏ vượt quá số khách đang giữ của loại này");
                    bottles=-input.quantity();
                    // Release the original obligation proportionally; later price edits must not rewrite old deposits.
                    liability=type.liability().multiply(BigDecimal.valueOf(input.quantity())).divide(BigDecimal.valueOf(type.held()),2,RoundingMode.HALF_UP).negate();
                    if(input.kind().equals("LOSS")) deposit=liability.abs().min(balance.depositHeld().max(BigDecimal.ZERO)).negate();
                }
            }
            case "COLLECT", "REFUND" -> {
                if(input.amount()==null || input.amount().signum()<=0 || input.quantity()!=null || input.bottleTypeId()!=null)
                    throw new BadRequestException("Nhập số tiền dương; giao dịch cọc không có số lượng hoặc loại vỏ");
                if(input.kind().equals("REFUND")) {
                    if(input.note()==null) throw new BadRequestException("Nhập lý do hoàn cọc");
                    if(input.amount().compareTo(balance.refundable())>0) throw new ConflictException("Số tiền vượt quá cọc được hoàn sau khi trừ nghĩa vụ vỏ còn giữ");
                    deposit=input.amount().negate();
                } else deposit=input.amount();
            }
            default -> throw new BadRequestException("Nghiệp vụ không hợp lệ");
        }
        return repository.insert(customer,actor,input,bottles,deposit,liability);
    }
}
