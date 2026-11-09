package com.aquaflow.delivery.application;

import com.aquaflow.bottle.BottleLedgerDtos.Create;
import com.aquaflow.bottle.BottleLedgerRepository;
import com.aquaflow.bottle.BottleLedgerService;
import com.aquaflow.delivery.api.DeliveryDtos.CollectionRequest;
import com.aquaflow.delivery.repository.DeliveryRepository;
import com.aquaflow.shared.api.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.*;

@Service
@Transactional(readOnly=true)
public class DeliveryBottleService {
    private final JdbcTemplate jdbc;
    private final DeliveryRepository delivery;
    private final BottleLedgerRepository ledger;
    private final BottleLedgerService bottles;
    public DeliveryBottleService(JdbcTemplate jdbc,DeliveryRepository delivery,BottleLedgerRepository ledger,BottleLedgerService bottles) {
        this.jdbc=jdbc; this.delivery=delivery; this.ledger=ledger; this.bottles=bottles;
    }
    public record ReturnLine(@NotNull @Positive Long bottleTypeId,@Min(1) int quantity) {}
    public record ReturnRequest(@NotNull UUID requestId,@NotEmpty @Size(max=100) List<@NotNull @Valid ReturnLine> lines) {}
    public record Line(long bottleTypeId,String name,int given,int returned,BigDecimal unitDeposit) {}
    public record Receipt(UUID requestId,String typeName,int quantity,String actor,OffsetDateTime at) {}
    public record ReturnReceipt(UUID requestId,List<Receipt> lines) {}
    public record View(boolean tracked,boolean linkedCustomer,boolean given,boolean canReturn,List<Line> lines,List<Receipt> receipts) {}

    private UUID key(String value) { return UUID.nameUUIDFromBytes(value.getBytes(StandardCharsets.UTF_8)); }
    /** Called after the load manifest is captured, in the same departure transaction. */
    @Transactional
    public void capture(long trip,long order) {
        long assignment=delivery.activeAssignment(trip,order).id();
        int inserted=jdbc.update("INSERT INTO delivery_bottle_manifests(assignment_id,customer_id) SELECT ?,customer_id FROM orders WHERE id=? ON CONFLICT DO NOTHING",assignment,order);
        if(inserted==0) return;
        jdbc.update("""
            INSERT INTO delivery_bottle_lines(assignment_id,bottle_type_id,quantity,unit_deposit)
            SELECT ?,t.id,SUM(l.quantity_loaded),t.deposit_unit_amount
            FROM delivery_load_items l JOIN product_batches b ON b.id=l.batch_id
            JOIN products p ON p.id=b.product_id JOIN bottle_types t ON t.id=p.bottle_type_id
            WHERE l.assignment_id=? GROUP BY t.id,t.deposit_unit_amount
            """,assignment,assignment);
    }
    /** Called only for SUCCESS; failed trips never increase customer-held bottles. */
    @Transactional
    public void give(long assignment,long order,long actor) {
        var manifests=jdbc.queryForList("SELECT * FROM delivery_bottle_manifests WHERE assignment_id=? FOR UPDATE",assignment);
        if(manifests.isEmpty() || Boolean.TRUE.equals(manifests.getFirst().get("given"))) return;
        Long customer=(Long)manifests.getFirst().get("customer_id");
        if(customer!=null) {
            ledger.lockCustomer(customer);
            for(var line:lines(assignment)) {
                var input=new Create(key("delivery-give:"+assignment+":"+line.bottleTypeId()),"GIVE",line.bottleTypeId(),line.given(),null,"Giao hàng · đơn #"+order+" · phân công #"+assignment);
                ledger.insert(customer,actor,input,line.given(),BigDecimal.ZERO,line.unitDeposit().multiply(BigDecimal.valueOf(line.given())));
                linkOrder(input.requestId(),order);
            }
        }
        jdbc.update("UPDATE delivery_bottle_manifests SET given=true WHERE assignment_id=?",assignment);
    }
    private void linkOrder(UUID id,long order) { jdbc.update("UPDATE bottle_transactions SET order_id=? WHERE ledger_request_id=?",order,id); }
    private List<Line> lines(long assignment) {
        return jdbc.query("""
            SELECT l.*,t.name,COALESCE((SELECT SUM(r.quantity) FROM delivery_bottle_return_lines r
                JOIN delivery_bottle_return_requests q ON q.id=r.request_id WHERE q.assignment_id=l.assignment_id AND r.bottle_type_id=l.bottle_type_id),0) returned
            FROM delivery_bottle_lines l JOIN bottle_types t ON t.id=l.bottle_type_id WHERE l.assignment_id=? ORDER BY l.bottle_type_id
            """,(r,n)->new Line(r.getLong("bottle_type_id"),r.getString("name"),r.getInt("quantity"),r.getInt("returned"),r.getBigDecimal("unit_deposit")),assignment);
    }
    private void visible(DeliveryRepository.TripRow trip,long actor,boolean staff) {
        if(!staff && !Objects.equals(trip.driverId(),actor)) throw new AccessDeniedException("Chỉ xem vỏ của chuyến được phân công");
    }
    public ReturnReceipt receipt(long assignment,UUID id,long actor,boolean staff) {
        var entries=view(assignment,actor,staff).receipts().stream().filter(r->r.requestId().equals(id)).toList();
        if(entries.isEmpty()) throw new NotFoundException("Không tìm thấy phiếu thu vỏ của phân công");
        return new ReturnReceipt(id,entries);
    }
    public View view(long assignment,long actor,boolean staff) {
        var a=delivery.assignment(assignment);
        var trip=delivery.findTrip(a.tripId()); visible(trip,actor,staff);
        var rows=jdbc.queryForList("SELECT * FROM delivery_bottle_manifests WHERE assignment_id=?",assignment);
        if(rows.isEmpty()) return new View(false,false,false,false,List.of(),List.of());
        var row=rows.getFirst(); boolean linked=row.get("customer_id")!=null, given=Boolean.TRUE.equals(row.get("given"));
        var receipts=jdbc.query("""
            SELECT q.id,t.name,r.quantity,u.full_name,q.created_at FROM delivery_bottle_return_requests q
            JOIN delivery_bottle_return_lines r ON r.request_id=q.id JOIN bottle_types t ON t.id=r.bottle_type_id
            JOIN users u ON u.id=q.actor_id WHERE q.assignment_id=? ORDER BY q.created_at DESC,t.id
            """,(r,n)->new Receipt(r.getObject("id",UUID.class),r.getString("name"),r.getInt("quantity"),r.getString("full_name"),r.getObject("created_at",OffsetDateTime.class)),assignment);
        return new View(true,linked,given,linked && given && "IN_PROGRESS".equals(trip.status()),lines(assignment),receipts);
    }
    @Transactional
    public View receive(long assignment,long actor,boolean staff,ReturnRequest request) {
        var a=delivery.assignment(assignment);
        var trip=delivery.lockTrip(a.tripId()); visible(trip,actor,staff);
        delivery.lockOrder(a.orderId());
        if(request.lines()==null || request.lines().isEmpty()) throw new BadRequestException("Nhập số vỏ thực nhận theo từng loại");
        var sorted=new TreeMap<Long,Integer>();
        for(var line:request.lines()) if(line.bottleTypeId()==null || line.quantity()<=0 || sorted.putIfAbsent(line.bottleTypeId(),line.quantity())!=null)
            throw new BadRequestException("Loại vỏ không được lặp; số lượng phải nguyên dương");
        String payload=sorted.toString();
        var existing=jdbc.queryForList("SELECT * FROM delivery_bottle_return_requests WHERE id=?",request.requestId());
        if(!existing.isEmpty()) {
            var old=existing.getFirst();
            if(!Objects.equals(old.get("assignment_id"),assignment) || !Objects.equals(old.get("actor_id"),actor) || !payload.equals(old.get("payload")))
                throw new ConflictException("Mã yêu cầu đã dùng cho phiếu khác");
            return view(assignment,actor,staff);
        }
        var state=view(assignment,actor,staff);
        if(!state.canReturn()) throw new ConflictException("Chỉ thu vỏ sau khi giao thành công, trước đối soát, trên chuyến có liên kết sổ vỏ");
        long customer=jdbc.queryForObject("SELECT customer_id FROM delivery_bottle_manifests WHERE assignment_id=?",Long.class,assignment);
        ledger.lockCustomer(customer);
        long total=0;
        for(var item:sorted.entrySet()) {
            var line=state.lines().stream().filter(l->l.bottleTypeId()==item.getKey()).findFirst().orElseThrow(()->new BadRequestException("Loại vỏ không thuộc phân công"));
            if(item.getValue()>line.given()-line.returned()) throw new ConflictException("Số vỏ vượt số còn được đổi của loại "+line.name());
            total+=item.getValue();
        }
        if(total>Integer.MAX_VALUE) throw new BadRequestException("Số vỏ quá lớn");
        jdbc.update("INSERT INTO delivery_bottle_return_requests(id,assignment_id,actor_id,payload) VALUES (?,?,?,?)",request.requestId(),assignment,actor,payload);
        for(var item:sorted.entrySet()) {
            var input=new Create(key("delivery-receive:"+request.requestId()+":"+item.getKey()),"RECEIVE",item.getKey(),item.getValue(),null,"Thu vỏ · đơn #"+a.orderId()+" · phân công #"+assignment);
            bottles.create(customer,actor,false,input);
            linkOrder(input.requestId(),a.orderId());
            jdbc.update("INSERT INTO delivery_bottle_return_lines(request_id,bottle_type_id,quantity) VALUES (?,?,?)",request.requestId(),item.getKey(),item.getValue());
        }
        // The trip's existing settlement totals include these shells, without a sale payment or deposit refund.
        delivery.collect(assignment,a.orderId(),actor,new CollectionRequest(request.requestId(),BigDecimal.ZERO,"CASH",(int)total));
        return view(assignment,actor,staff);
    }
}
