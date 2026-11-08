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
        return createForAssignment(request, actor, null);
    }
    @Transactional
    public Inspection createForAssignment(Create request, long actor, Long assignmentId) {
        repository.lockOrder(request.orderId());
        if (request.lines() == null || request.lines().isEmpty()) throw new BadRequestException("Cần ít nhất một dòng hàng thực nhận");
        boolean explicitQuantity = request.lines().stream().anyMatch(line -> line.quantity() != null);
        if (explicitQuantity && request.requestId() == null) throw new BadRequestException("Cần requestId cho phiếu thực nhận");
        String note=request.note()==null?null:request.note().trim();
        String hash = fingerprint(request, actor, note);
        var replay = repository.replay(request.requestId());
        if (replay.isPresent()) {
            var saved = repository.get(replay.get().id());
            if (!hash.equals(replay.get().hash()) || (assignmentId != null && saved.assignmentId() != assignmentId))
                throw new ConflictException("requestId đã được dùng cho nội dung phiếu khác");
            return saved;
        }
        Pending pending=repository.pending().stream().filter(p->p.orderId()==request.orderId()).findFirst()
            .orElseThrow(()->new ConflictException("Đơn không còn chờ hoàn hàng; cần kết thúc chuyến thất bại trước khi kiểm nhận"));
        if (assignmentId != null && pending.assignmentId() != assignmentId)
            throw new ConflictException("Lần giao không còn chờ kiểm nhận hàng hoàn");
        Map<Long,LineInput> values=new HashMap<>();
        for(var line:request.lines()) {
            if(line.loadItemId()==null || line.sellable()==null || values.put(line.loadItemId(),line)!=null) throw new BadRequestException("Dòng kiểm hàng không hợp lệ hoặc bị trùng");
        }
        if(pending.lines().isEmpty() || (!explicitQuantity && values.size()!=pending.lines().size())) throw new BadRequestException("Cần kiểm đủ từng lô hàng");
        if (values.keySet().stream().anyMatch(id -> pending.lines().stream().noneMatch(line -> line.loadItemId() == id)))
            throw new BadRequestException("Lô không thuộc hàng đang chờ kiểm nhận");
        boolean damaged=false;
        LocalDate today=LocalDate.now(clock);
        for(var line:pending.lines()) {
            var input=values.get(line.loadItemId());
            if (input == null) continue;
            if (explicitQuantity && input.quantity() == null) throw new BadRequestException("Cần nhập số lượng thực nhận từng dòng");
            int quantity=input.quantity()==null?line.quantity():input.quantity();
            int sellable=input.sellable();
            if(quantity<=0 || quantity>line.quantity() || sellable<0 || sellable>quantity) throw new BadRequestException("Số lượng thực nhận hoặc bán lại không hợp lệ; không được vượt hàng còn chờ");
            if(sellable>0 && !line.expiresOn().isAfter(today)) throw new BadRequestException("Lô đã hết hạn không thể nhập lại hàng bán được");
            damaged |= sellable<quantity;
        }
        if(damaged && (note==null || note.isEmpty())) throw new BadRequestException("Cần ghi tình trạng hàng hỏng hoặc hết hạn");
        long id=repository.create(pending,actor,note,request.requestId(),hash);
        for(var line:pending.lines()) {
            var input=values.get(line.loadItemId());
            if(input!=null) repository.receive(id,pending.orderId(),line,input.quantity()==null?line.quantity():input.quantity(),input.sellable(),actor,note);
        }
        repository.closeOrder(pending.orderId());
        return repository.get(id);
    }

    private String fingerprint(Create request, long actor, String note) {
        String value=request.orderId()+"|"+actor+"|"+request.lines().stream()
                .sorted(Comparator.comparing(LineInput::loadItemId, Comparator.nullsFirst(Comparator.naturalOrder())))
                .toList()+"|"+note;
        try {
            return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
}
