package com.aquaflow.inventory.application;

import com.aquaflow.inventory.api.ReturnDtos.*;
import com.aquaflow.inventory.repository.InventoryReturnRepository;
import com.aquaflow.shared.api.BadRequestException;
import com.aquaflow.shared.api.ConflictException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.Clock;
import java.util.*;

@Service
@Transactional(readOnly=true)
public class InventoryReturnService {
    private final InventoryReturnRepository repository;
    private final Clock clock;
    public InventoryReturnService(InventoryReturnRepository repository, Clock clock) {
        this.repository=repository;
        this.clock=clock;
    }
    public List<Pending> pending() { return repository.pending(); }
    public List<Inspection> list(int page, int size) {
        if(page<0 || page>100000 || size<1 || size>100) throw new BadRequestException("Phân trang không hợp lệ");
        return repository.list(page,size);
    }
    public Inspection get(long id) { return repository.get(id); }
    @Transactional
    public Inspection create(Create request, long actor) {
        repository.lockOrder(request.orderId());
        Pending pending=repository.pending().stream().filter(p->p.orderId()==request.orderId()).findFirst()
            .orElseThrow(()->new ConflictException("Đơn không còn chờ hoàn hàng; cần kết thúc chuyến thất bại trước khi kiểm nhận"));
        Map<Long,Integer> values=new HashMap<>();
        for(var line:request.lines()) {
            if(values.put(line.loadItemId(),line.sellable())!=null) throw new BadRequestException("Trùng dòng kiểm hàng");
        }
        if(pending.lines().isEmpty() || values.size()!=pending.lines().size()) throw new BadRequestException("Cần kiểm đủ từng lô hàng");
        boolean damaged=false;
        LocalDate today=LocalDate.now(clock);
        for(var line:pending.lines()) {
            Integer sellable=values.get(line.loadItemId());
            if(sellable==null || sellable<0 || sellable>line.quantity()) throw new BadRequestException("Số lượng kiểm không hợp lệ");
            if(sellable>0 && !line.expiresOn().isAfter(today)) throw new BadRequestException("Lô đã hết hạn không thể nhập lại hàng bán được");
            damaged |= sellable<line.quantity();
        }
        String note=request.note()==null?null:request.note().trim();
        if(damaged && (note==null || note.isEmpty())) throw new BadRequestException("Cần ghi tình trạng hàng hỏng hoặc hết hạn");
        long id=repository.create(pending,actor,note);
        for(var line:pending.lines()) repository.receive(id,pending.orderId(),line,values.get(line.loadItemId()),actor,note);
        repository.closeOrder(pending.orderId());
        return repository.get(id);
    }
}
