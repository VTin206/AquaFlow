package com.aquaflow.operations.application;

import com.aquaflow.shared.api.*;
import com.aquaflow.inventory.application.*;
import com.aquaflow.inventory.api.dto.*;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.EntityManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import static com.aquaflow.operations.application.WorkspaceData.*;

/** Commands own transactions; browser-supplied totals, identities and balances are never trusted. */
@Service
public class WorkspaceCommands {
    private final JdbcTemplate db;
    private final WorkspaceQueries q;
    private final StockReservationService stock;
    private final PurchaseReceiptService receipts;
    private final EntityManager entities;
    public WorkspaceCommands(JdbcTemplate db,WorkspaceQueries q,StockReservationService stock,PurchaseReceiptService receipts,EntityManager entities) {
        this.db=db;this.q=q;this.stock=stock;this.receipts=receipts;this.entities=entities;
    }
    private void check(boolean condition,String message) { if(!condition) throw new BadRequestException(message); }
    private long insert(String sql,Object... args) { return Objects.requireNonNull(db.queryForObject(sql,Long.class,args)); }
    private void audit(long actor,String area,long id,String message) {
        db.update("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,reason) VALUES (?,'WORKSPACE',?,?,?)",actor,area,id,message);
    }
    @Transactional
    public Object execute(String resource,String action,JsonNode args,long actor,UUID requestId) {
        // Serialise admin commands and idempotency checks; inventory also uses row locks shared with existing APIs.
        db.execute("SELECT pg_advisory_xact_lock(940051)");
        String signature=resource+"/"+action+":"+args.toString();
        var previous=db.queryForList("SELECT * FROM workspace_requests WHERE request_id=?",requestId);
        if(!previous.isEmpty()) {
            var p=previous.getFirst();
            if(number(p.get("actor_id"))!=actor || !signature.equals(p.get("signature"))) throw new ConflictException("Mã yêu cầu đã được dùng cho thao tác khác.");
            return json(p.get("result"));
        }
        Object result=switch(resource+"/"+action) {
            case "products/create" -> createProduct(args.path(0),actor);
            case "products/createReceipt" -> createReceipt(args.path(0),actor);
            case "suppliers/create" -> createSupplier(args.path(0),actor);
            case "customers/create" -> saveCustomer(null,args.path(0),actor);
            case "customers/update" -> saveCustomer(id(args.path(0)),args.path(1),actor);
            case "customers/recordBottles" -> recordBottles(id(args.path(0)),args.path(1),actor);
            case "orders/create" -> createOrder(args.path(0),actor);
            case "orders/advanceStatus" -> advance(lockOrder(args.path(0).asText()),actor);
            case "orders/receive" -> receive(lockOrder(args.path(0).asText()),args.path(1),actor);
            case "orders/pay" -> pay(lockOrder(args.path(0).asText()),args.path(1),actor);
            case "orders/cancel" -> cancel(lockOrder(args.path(0).asText()),args.path(1).asText(),args.path(2),actor);
            case "orders/returnItems" -> returnItems(lockOrder(args.path(0).asText()),args.path(1),actor);
            case "trips/create" -> createTrip(args.path(0),actor);
            case "trips/depart" -> depart(id(args.path(0)),actor);
            case "trips/cancel" -> cancelTrip(id(args.path(0)),actor);
            case "trips/removeOrder" -> removeTripOrder(id(args.path(0)),args.path(1).asText(),actor);
            case "trips/settle" -> settle(id(args.path(0)),args.path(1),actor);
            case "settings/update" -> settings(args.path(0),actor);
            default -> throw new NotFoundException("Chức năng không tồn tại.");
        };
        entities.flush();
        db.update("INSERT INTO workspace_requests(request_id,actor_id,signature,result) VALUES (?,?,?,?::jsonb)",requestId,actor,signature,encode(result));
        return result;
    }
    private Object createProduct(JsonNode d,long actor) {
        String sku=text(d,"sku",64,true),name=text(d,"name",200,true),unit=text(d,"unit",40,true),image=text(d,"image",7_000_000,false);
        check(image.isEmpty() || image.startsWith("/images/") || image.startsWith("https://") || image.matches("(?s)^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$"),"Ảnh phải là PNG, JPG, WEBP hoặc đường dẫn ảnh hợp lệ.");
        check(db.queryForObject("SELECT count(*) FROM products WHERE lower(sku)=lower(?)",Long.class,sku)==0,"Mã sản phẩm đã tồn tại.");
        int quantity=integer(d,"stock",0,1_000_000);
        String expires=text(d,"openingExpiresOn",10,false);
        if(quantity>0 && !unit.equals("Vỏ")) check(!expires.isEmpty() && date(expires).isAfter(LocalDate.now(ZONE)),"Nhập hạn sử dụng hợp lệ cho tồn kho ban đầu.");
        long id=insert("INSERT INTO products(sku,name,brand,unit,sale_price,image_url,low_stock_threshold) VALUES (?,?,?,?,?,?,COALESCE((SELECT (settings->>'defaultLowStock')::int FROM store_settings WHERE id=1),10)) RETURNING id",sku,name,text(d,"brand",150,false),unit,money(d,"price",false),image.isEmpty()?null:image);
        if(quantity>0) {
            long batch=insert("INSERT INTO product_batches(product_id,lot_code,expires_on) VALUES (?,?,?) RETURNING id",id,"OPEN-"+id,unit.equals("Vỏ")?LocalDate.of(9999,12,31):date(expires));
            db.update("INSERT INTO inventory_balances(batch_id,on_hand) VALUES (?,?)",batch,quantity);
            movement(batch,quantity,"ADJUST_UP","PRODUCT",id,actor,"Tồn đầu kỳ khi tạo sản phẩm");
        }
        audit(actor,"Kho hàng",id,"Thêm sản phẩm "+name);
        return q.product(id);
    }
    private Object createSupplier(JsonNode d,long actor) {
        String name=text(d,"name",200,true),phone=text(d,"phone",30,true);
        long id=insert("INSERT INTO suppliers(name,phone,address,contact_name,email) VALUES (?,?,?,?,?) RETURNING id",name,phone(phone),text(d,"address",2000,true),text(d,"contactName",150,false),text(d,"email",254,false));
        audit(actor,"Nhà cung cấp",id,"Thêm nhà cung cấp "+name);
        return q.suppliers().stream().filter(s->str(s.get("id")).equals(""+id)).findFirst().orElseThrow();
    }
    private Object createReceipt(JsonNode d,long actor) {
        long supplier=id(d.path("supplierId"));
        q.one("SELECT id FROM suppliers WHERE id=? AND active",supplier);
        LocalDate received=date(text(d,"receivedAt",10,true));
        check(!received.isAfter(LocalDate.now(ZONE)),"Ngày nhập không được ở tương lai.");
        String receiver=text(d,"receiver",150,true);
        check(d.path("lines").isArray() && !d.path("lines").isEmpty() && d.path("lines").size()<=200,"Phiếu nhập cần từ 1 đến 200 dòng.");
        List<PurchaseItemRequest> items=new ArrayList<>();Set<String> keys=new HashSet<>();
        for(JsonNode l:d.path("lines")) {
            long productId=id(l.path("productId"));var p=q.one("SELECT * FROM products WHERE id=? AND active",productId);
            int count=integer(l,"received",1,1_000_000),damaged=l.has("damaged")?integer(l,"damaged",0,count):0;
            boolean shell="Vỏ".equals(p.get("unit"));
            String code=text(l,"lotCode",100,!shell);
            if(code.isEmpty()) code="SHELL-"+UUID.randomUUID();
            check(keys.add(productId+"/"+code.toLowerCase(Locale.ROOT)),"Phiếu có dòng trùng sản phẩm và lô.");
            LocalDate expiry=shell?LocalDate.of(9999,12,31):date(text(l,"expiryDate",10,true));
            check(expiry.isAfter(LocalDate.now(ZONE)),"Lô đã hết hạn, không thể nhập vào tồn bán được.");
            String mfg=text(l,"mfgDate",10,false);LocalDate manufactured=mfg.isEmpty()?null:date(mfg);
            check(manufactured==null || (!manufactured.isAfter(received) && manufactured.isBefore(expiry)),"Ngày sản xuất không hợp lệ.");
            items.add(new PurchaseItemRequest(productId,code,manufactured,expiry,count,count-damaged,money(l,"costPrice",false)));
        }
        var receipt=receipts.create(new PurchaseReceiptRequest(supplier,received.atStartOfDay(ZoneOffset.UTC).toInstant(),text(d,"note",2000,false),items),actor);
        receipts.confirm(receipt.id(),actor);entities.flush();
        db.update("UPDATE purchase_receipts SET receiver_name=? WHERE id=?",receiver,receipt.id());
        audit(actor,"Kho hàng",receipt.id(),"Nhập kho: "+items.size()+" dòng sản phẩm");
        return q.receipts().stream().filter(r->str(r.get("id")).equals(""+receipt.id())).findFirst().orElseThrow();
    }
    private Object saveCustomer(Long id,JsonNode d,long actor) {
        String name=text(d,"name",150,true),phone=phone(text(d,"phone",30,true));
        String type=text(d,"type",20,true),area=text(d,"area",150,false),note=text(d,"note",2000,false);
        check(List.of("Cá nhân","Doanh nghiệp").contains(type),"Loại khách hàng không hợp lệ.");
        check(d.path("addresses").isArray() && d.path("addresses").size()<=30,"Danh sách địa chỉ không hợp lệ.");
        if(id==null) id=insert("INSERT INTO customers(full_name,phone,customer_type,area,note) VALUES (?,?,?,?,?) RETURNING id",name,phone,type,area,note);
        else {q.one("SELECT * FROM customers WHERE id=? AND active FOR UPDATE",id);db.update("UPDATE customers SET full_name=?,phone=?,customer_type=?,area=?,note=? WHERE id=?",name,phone,type,area,note,id);}
        db.update("DELETE FROM customer_addresses WHERE customer_id=?",id);
        Set<String> seen=new LinkedHashSet<>();
        for(JsonNode a:d.path("addresses")) {check(a.isTextual() && a.asText().length()<=2000,"Địa chỉ không hợp lệ.");if(!a.asText().isBlank()) seen.add(a.asText().trim());}
        boolean first=true;
        for(String address:seen) {db.update("INSERT INTO customer_addresses(customer_id,recipient_name,recipient_phone,address_line,area,is_default) VALUES (?,?,?,?,?,?)",id,name,phone,address,area,first);first=false;}
        audit(actor,"Khách hàng",id,"Lưu hồ sơ "+name);
        return q.customer(q.one("SELECT * FROM customers WHERE id=?",id));
    }
    private Long ensureCustomer(String name,String phone,String address,long actor) {
        if(name.isBlank() || phone.isBlank()) return null;
        var existing=db.queryForList("SELECT * FROM customers WHERE active AND phone=? FOR UPDATE",phone);
        long id=existing.isEmpty()?insert("INSERT INTO customers(full_name,phone) VALUES (?,?) RETURNING id",name,phone):number(existing.getFirst().get("id"));
        if(!address.isBlank() && db.queryForObject("SELECT count(*) FROM customer_addresses WHERE customer_id=? AND address_line=?",Long.class,id,address)==0) {
            boolean first=db.queryForObject("SELECT count(*) FROM customer_addresses WHERE customer_id=?",Long.class,id)==0;
            db.update("INSERT INTO customer_addresses(customer_id,recipient_name,recipient_phone,address_line,is_default) VALUES (?,?,?,?,?)",id,name,phone,address,first);
        }
        if(existing.isEmpty()) audit(actor,"Khách hàng",id,"Tạo hồ sơ từ đơn hàng: "+name);
        return id;
    }
    private Object createOrder(JsonNode d,long actor) {
        String method=text(d,"method",40,true),channel=text(d,"channel",40,true);
        check(List.of("Tại quầy","Giao tận nơi").contains(method),"Hình thức nhận hàng không hợp lệ.");
        String channelCode=switch(channel){case "Tại quầy"->"COUNTER";case "Điện thoại"->"PHONE";case "Tin nhắn"->"MESSAGE";case "Website"->"WEB";default->throw new BadRequestException("Kênh đặt hàng không hợp lệ.");};
        boolean delivery=method.equals("Giao tận nơi");String name=text(d,"customer",150,delivery),phone=text(d,"phone",30,delivery),address=text(d,"address",2000,delivery);
        if(!phone.isEmpty()) phone=phone(phone);
        BigDecimal fee=delivery?money(d,"deliveryFee",false):BigDecimal.ZERO;
        int floor=d.has("floor")?integer(d,"floor",0,30):0;
        String appt=text(d,"appointment",60,false);Timestamp appointment=null;
        if(!appt.isEmpty()) {try {appointment=Timestamp.from(Instant.parse(appt));}catch(Exception e){throw new BadRequestException("Giờ hẹn không hợp lệ.");}check(appointment.toInstant().isAfter(Instant.now()),"Giờ hẹn phải ở tương lai.");}
        check(d.path("lines").isArray() && !d.path("lines").isEmpty() && d.path("lines").size()<=200,"Đơn cần từ 1 đến 200 dòng.");
        Map<Long,Integer> quantities=new TreeMap<>();
        for(JsonNode l:d.path("lines")) quantities.merge(id(l.path("productId")),integer(l,"quantity",1,1_000_000),Math::addExact);
        BigDecimal subtotal=BigDecimal.ZERO;Map<Long,Map<String,Object>> products=new LinkedHashMap<>();
        for(var entry:quantities.entrySet()) {
            var p=q.one("SELECT * FROM products WHERE id=? AND active FOR SHARE",entry.getKey());
            check(!"VO-20L".equals(p.get("sku")),"Vỏ luân chuyển được ghi qua sổ vỏ.");
            if("Bình".equals(p.get("unit"))) check(!name.isEmpty() && !phone.isEmpty(),"Cần hồ sơ khách khi mua bình đổi vỏ.");
            products.put(entry.getKey(),p);subtotal=subtotal.add(amount(p.get("sale_price")).multiply(BigDecimal.valueOf(entry.getValue())));
        }
        Long customer=ensureCustomer(name,phone,delivery?address:"",actor);
        String code="AF-"+UUID.randomUUID().toString().replace("-","").substring(0,12).toUpperCase(Locale.ROOT);
        long id=insert("INSERT INTO orders(order_code,customer_id,created_by,channel,fulfillment_type,recipient_name,recipient_phone,delivery_address,requested_delivery_at,subtotal,delivery_fee,delivery_floor,note,tracking_token) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
            code,customer,actor,channelCode,delivery?"DELIVERY":"COUNTER",name.isEmpty()?"Khách vãng lai":name,phone,delivery?address:null,appointment,subtotal,fee,floor,text(d,"note",2000,false),UUID.randomUUID().toString().replace("-","")+UUID.randomUUID().toString().replace("-",""));
        for(var e:quantities.entrySet()) {BigDecimal price=amount(products.get(e.getKey()).get("sale_price"));db.update("INSERT INTO order_items(order_id,product_id,quantity,unit_price,line_total) VALUES (?,?,?,?,?)",id,e.getKey(),e.getValue(),price,price.multiply(BigDecimal.valueOf(e.getValue())));}
        audit(actor,"Đơn hàng",id,"Tiếp nhận yêu cầu, chờ xác nhận và giữ hàng.");
        return q.orderById(id);
    }
    private Map<String,Object> lockOrder(String code) { return q.one("SELECT * FROM orders WHERE order_code=? FOR UPDATE",code); }
    private Object advance(Map<String,Object> order,long actor) {
        long id=number(order.get("id"));String state=str(order.get("status"));
        if(state.equals("PENDING")) {
            var items=db.queryForList("SELECT * FROM order_items WHERE order_id=? ORDER BY product_id",id);
            check(!items.isEmpty(),"Đơn không có sản phẩm.");
            stock.reserve(items.stream().map(i->new ReservationLine(number(i.get("id")),number(i.get("product_id")),(int)number(i.get("quantity")))).toList());
            entities.flush();
            db.update("UPDATE orders SET status='CONFIRMED',confirmed_at=NOW() WHERE id=?",id);
            audit(actor,"Đơn hàng",id,"Xác nhận đơn, giữ hàng theo lô hết hạn sớm nhất.");
        } else {
            check(List.of("CONFIRMED","PREPARING").contains(state) && "DELIVERY".equals(order.get("fulfillment_type")),"Đơn chưa sẵn sàng xuất giao.");
            checkReservedExpiry(id);
            db.update("UPDATE orders SET status='OUT_FOR_DELIVERY',delivery_failed=false WHERE id=?",id);
            audit(actor,"Đơn hàng",id,"Bắt đầu giao hàng.");
        }
        return q.orderById(id);
    }
    private void checkReservedExpiry(long id) {
        long expired=db.queryForObject("SELECT count(*) FROM stock_reservations r JOIN order_items i ON i.id=r.order_item_id JOIN product_batches b ON b.id=r.batch_id WHERE i.order_id=? AND r.quantity_reserved-r.quantity_dispatched-r.quantity_released>0 AND b.expires_on<CURRENT_DATE",Long.class,id);
        check(expired==0,"Lô hàng đã hết hạn. Hủy đơn và tạo lại để chọn lô còn hạn.");
    }
    private void movement(long batch,int quantity,String type,String reference,long referenceId,long actor,String reason) {
        db.update("INSERT INTO inventory_movements(batch_id,movement_type,quantity,reference_type,reference_id,performed_by,reason) VALUES (?,?,?,?,?,?,?)",batch,type,quantity,reference,referenceId,actor,reason);
    }
    private Object receive(Map<String,Object> order,JsonNode d,long actor) {
        long id=number(order.get("id"));String state=str(order.get("status"));
        boolean counter="COUNTER".equals(order.get("fulfillment_type")) && List.of("CONFIRMED","PREPARING").contains(state);
        check(counter || state.equals("OUT_FOR_DELIVERY"),"Đơn chưa sẵn sàng bàn giao.");
        check(d.path("success").isBoolean(),"Chọn kết quả bàn giao.");
        if(!d.path("success").booleanValue()) {
            check(!counter,"Đơn tại quầy không có giao thất bại.");String reason=text(d,"reason",2000,true);
            db.update("UPDATE orders SET status='PREPARING',delivery_failed=true WHERE id=?",id);
            audit(actor,"Đơn hàng",id,"Giao thất bại: "+reason);
            return q.orderById(id);
        }
        String receiver=text(d,"receiver",150,!counter);checkReservedExpiry(id);
        var reservations=db.queryForList("SELECT r.* FROM stock_reservations r JOIN order_items i ON i.id=r.order_item_id WHERE i.order_id=? ORDER BY r.batch_id FOR UPDATE OF r",id);
        long required=db.queryForObject("SELECT sum(quantity) FROM order_items WHERE order_id=?",Long.class,id);
        long reserved=reservations.stream().mapToLong(r->number(r.get("quantity_reserved"))-number(r.get("quantity_dispatched"))-number(r.get("quantity_released"))).sum();
        check(reserved==required,"Đơn chưa được giữ đủ hàng.");
        int returned=d.has("bottlesReturned")?integer(d,"bottlesReturned",0,1_000_000):0;
        BigDecimal deposit=d.has("depositCollected")?money(d,"depositCollected",false):BigDecimal.ZERO;
        int given=db.queryForObject("SELECT COALESCE(sum(i.quantity),0) FROM order_items i JOIN products p ON p.id=i.product_id WHERE i.order_id=? AND p.unit='Bình'",Integer.class,id);
        if(given>0 || returned>0 || deposit.signum()>0) {
            check(order.get("customer_id")!=null,"Đơn chưa gắn hồ sơ khách để ghi vỏ/cọc.");
            long customer=number(order.get("customer_id"));q.one("SELECT id FROM customers WHERE id=? FOR UPDATE",customer);
            check(returned<=number(q.balance(customer).get("bottles"))+given,"Số vỏ thu vượt số khách đang giữ.");
            if(given>0) bottle(customer,id,"Giao kèm đơn",given,actor,null);
            if(returned>0) bottle(customer,id,"Thu vỏ",-returned,actor,null);
            if(deposit.signum()>0) deposit(customer,id,"Thu cọc",deposit,actor,null);
        }
        for(var r:reservations) {
            int quantity=(int)(number(r.get("quantity_reserved"))-number(r.get("quantity_dispatched"))-number(r.get("quantity_released")));if(quantity==0) continue;
            long batch=number(r.get("batch_id"));q.one("SELECT * FROM inventory_balances WHERE batch_id=? FOR UPDATE",batch);
            int changed=db.update("UPDATE inventory_balances SET on_hand=on_hand-?,reserved=reserved-?,version=version+1 WHERE batch_id=? AND on_hand>=? AND reserved>=?",quantity,quantity,batch,quantity,quantity);
            check(changed==1,"Tồn kho thay đổi, vui lòng kiểm tra lại.");
            db.update("UPDATE stock_reservations SET quantity_dispatched=quantity_dispatched+? WHERE id=?",quantity,r.get("id"));
            movement(batch,quantity,counter?"COUNTER_SALE":"DISPATCH","ORDER",id,actor,"Bàn giao cho khách");
        }
        String next=q.total(order).compareTo(q.paid(id))<=0?"COMPLETED":"DELIVERED";
        db.update("UPDATE orders SET status=?,delivered_at=NOW(),delivery_failed=false WHERE id=?",next,id);
        audit(actor,"Đơn hàng",id,(counter?"Khách nhận tại quầy":"Giao thành công")+" · Người nhận: "+receiver);
        return q.orderById(id);
    }
    private void payment(long order,BigDecimal value,String direction,JsonNode d,long actor) {
        String method=text(d,"method",30,true),reference=text(d,"reference",200,false);
        check(List.of("Tiền mặt","Chuyển khoản").contains(method),"Phương thức thanh toán không hợp lệ.");
        boolean bank=method.equals("Chuyển khoản");check(!bank || !reference.isEmpty(),"Nhập mã tham chiếu chuyển khoản.");
        db.update("INSERT INTO payments(order_id,direction,method,amount,status,external_reference,confirmed_by,confirmed_at,recorded_by) VALUES (?,?,?,?,'CONFIRMED',?,?,NOW(),?)",order,direction,bank?"BANK_TRANSFER":"CASH",value,bank?reference:null,actor,actor);
        audit(actor,"Đơn hàng",order,(direction.equals("OUT")?"Hoàn tiền ":"Ghi nhận thanh toán ")+value+" ₫ · "+method);
    }
    private void paymentStatus(long id) {
        var o=q.one("SELECT * FROM orders WHERE id=?",id);BigDecimal paid=q.paid(id),total=q.total(o);
        String status="CANCELLED".equals(o.get("status"))?"REFUNDED":paid.compareTo(total)>=0?"PAID":paid.signum()>0?"PARTIALLY_PAID":"UNPAID";
        db.update("UPDATE orders SET payment_status=?,status=CASE WHEN status='DELIVERED' AND ?='PAID' THEN 'COMPLETED' ELSE status END WHERE id=?",status,status,id);
    }
    private Object pay(Map<String,Object> o,JsonNode d,long actor) {
        long id=number(o.get("id"));check(!List.of("PENDING","CANCELLED","COMPLETED").contains(str(o.get("status"))),"Đơn chưa xác nhận hoặc không còn phải thu.");
        BigDecimal value=money(d,"amount",true);check(value.compareTo(q.total(o).subtract(q.paid(id)))<=0,"Số tiền vượt số còn phải thu.");
        payment(id,value,"IN",d,actor);paymentStatus(id);return q.orderById(id);
    }
    private Object cancel(Map<String,Object> o,String reason,JsonNode refund,long actor) {
        long id=number(o.get("id"));check(List.of("PENDING","CONFIRMED","PREPARING").contains(str(o.get("status"))),"Chỉ hủy khi hàng chưa đến khách và không đang trên đường giao.");
        check(!reason.isBlank() && reason.length()<=2000,"Nhập lý do hủy.");BigDecimal paid=q.paid(id);
        if(paid.signum()>0) payment(id,paid,"OUT",refund,actor);
        stock.release(db.queryForList("SELECT id FROM order_items WHERE order_id=?",Long.class,id));entities.flush();
        db.update("UPDATE orders SET status='CANCELLED',cancelled_at=NOW(),delivery_failed=false WHERE id=?",id);
        paymentStatus(id);audit(actor,"Đơn hàng",id,"Hủy đơn: "+reason.trim());return q.orderById(id);
    }
    private Object returnItems(Map<String,Object> o,JsonNode d,long actor) {
        long id=number(o.get("id"));check(List.of("DELIVERED","COMPLETED").contains(str(o.get("status"))),"Chỉ nhận trả hàng đã bàn giao.");
        String reason=text(d,"reason",2000,true);check(d.path("lines").isArray() && !d.path("lines").isEmpty(),"Chọn hàng trả.");
        check(d.path("restock").isBoolean(),"Chọn cách xử lý hàng trả.");boolean restock=d.path("restock").booleanValue();
        Map<Long,Integer> counts=new TreeMap<>();
        for(JsonNode l:d.path("lines")) {int count=integer(l,"quantity",0,1_000_000);if(count>0) counts.merge(id(l.path("productId")),count,Math::addExact);}
        check(!counts.isEmpty(),"Chọn ít nhất một sản phẩm trả.");BigDecimal value=BigDecimal.ZERO;Map<Long,Map<String,Object>> items=new LinkedHashMap<>();
        for(var e:counts.entrySet()) {
            var item=q.one("SELECT * FROM order_items WHERE order_id=? AND product_id=?",id,e.getKey());long itemId=number(item.get("id"));
            long previous=db.queryForObject("SELECT COALESCE(sum(quantity),0) FROM order_return_items WHERE order_item_id=?",Long.class,itemId);
            check(e.getValue()<=number(item.get("quantity"))-previous,"Số lượng trả vượt số đã mua chưa trả.");
            items.put(e.getKey(),item);value=value.add(amount(item.get("unit_price")).multiply(BigDecimal.valueOf(e.getValue())));
        }
        BigDecimal refund=q.paid(id).subtract(q.total(o).subtract(value)).max(BigDecimal.ZERO);
        if(refund.signum()>0) payment(id,refund,"OUT",JSON.valueToTree(map("method",d.path("refundMethod").asText(),"reference",d.path("refundReference").asText())),actor);
        long returnId=insert("INSERT INTO order_returns(order_id,reason,restocked,refunded,performed_by) VALUES (?,?,?,?,?) RETURNING id",id,reason,restock,refund,actor);
        for(var e:counts.entrySet()) {
            long itemId=number(items.get(e.getKey()).get("id"));long previous=db.queryForObject("SELECT COALESCE(sum(quantity),0) FROM order_return_items WHERE order_item_id=?",Long.class,itemId);
            db.update("INSERT INTO order_return_items(return_id,order_item_id,quantity) VALUES (?,?,?)",returnId,itemId,e.getValue());
            int remaining=e.getValue();
            // Attribute every return to the original dispatched batches, including non-restocked returns.
            var reservations=db.queryForList("SELECT r.*,b.expires_on FROM stock_reservations r JOIN product_batches b ON b.id=r.batch_id WHERE r.order_item_id=? ORDER BY r.id",itemId);
            for(var r:reservations) {
                int sent=(int)number(r.get("quantity_dispatched"));int skip=(int)Math.min(previous,sent);previous-=skip;
                int take=Math.min(remaining,sent-skip);if(take<=0) continue;
                if(restock) {
                    check(!date(str(r.get("expires_on"))).isBefore(LocalDate.now(ZONE)),"Hàng trả đã hết hạn, không nhập lại tồn bán được.");
                    db.update("UPDATE inventory_balances SET on_hand=on_hand+?,version=version+1 WHERE batch_id=?",take,r.get("batch_id"));
                    movement(number(r.get("batch_id")),take,"RETURN","ORDER_RETURN",returnId,actor,reason);
                }
                remaining-=take;if(remaining==0) break;
            }
            check(remaining==0,"Không tìm thấy đủ lô hàng đã xuất để nhận trả.");
        }
        paymentStatus(id);audit(actor,"Đơn hàng",id,"Nhận trả hàng: "+reason+" · Giá trị "+value+" ₫");return q.orderById(id);
    }
    private void bottle(long customer,Long order,String kind,int count,long actor,String note) {
        long type=insert("INSERT INTO bottle_types(name,deposit_unit_amount) VALUES ('Vỏ luân chuyển 20L',50000) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id");
        db.update("INSERT INTO bottle_transactions(customer_id,bottle_type_id,order_id,movement,quantity,performed_by,condition_note,entry_kind) VALUES (?,?,?,?,?,?,?,?)",customer,type,order,count>0?"GIVE":"RECEIVE",Math.abs(count),actor,note,kind);
    }
    private void deposit(long customer,Long order,String kind,BigDecimal value,long actor,String note) {
        db.update("INSERT INTO deposit_transactions(customer_id,order_id,direction,amount,created_by,entry_kind,note) VALUES (?,?,?,?,?,?,?)",customer,order,value.signum()>0?"COLLECT":"REFUND",value.abs(),actor,kind,note);
    }
    private Object recordBottles(long customer,JsonNode d,long actor) {
        q.one("SELECT * FROM customers WHERE id=? AND active FOR UPDATE",customer);var balance=q.balance(customer);
        String kind=text(d,"kind",40,true),note=text(d,"note",2000,false);long held=number(balance.get("bottles"));BigDecimal heldDeposit=amount(balance.get("deposit"));
        if(kind.equals("Thu vỏ") || kind.equals("Báo mất/vỡ")) {
            int count=integer(d,"bottles",1,1_000_000);check(count<=held,"Số vỏ vượt số khách đang giữ.");
            if(kind.equals("Báo mất/vỡ")) check(!note.isEmpty(),"Nhập lý do mất/vỡ.");
            bottle(customer,null,kind,-count,actor,note);
            BigDecimal deduction=BigDecimal.ZERO;
            if(kind.equals("Báo mất/vỡ")) deduction=heldDeposit.min(BigDecimal.valueOf(count*50000L));
            else if(d.path("pickup").asBoolean(false) && count<10) deduction=heldDeposit.min(BigDecimal.valueOf(30000));
            if(deduction.signum()>0) deposit(customer,null,kind.equals("Thu vỏ")?"Phí thu hồi":kind,deduction.negate(),actor,note);
        } else {
            check(List.of("Thu cọc","Hoàn cọc").contains(kind),"Nghiệp vụ vỏ không hợp lệ.");BigDecimal value=money(d,"deposit",true);
            if(kind.equals("Hoàn cọc")) {check(value.compareTo(heldDeposit.subtract(BigDecimal.valueOf(held*50000L)).max(BigDecimal.ZERO))<=0,"Tiền hoàn vượt cọc có thể hoàn; cần thu vỏ trước.");value=value.negate();}
            deposit(customer,null,kind,value,actor,note);
        }
        audit(actor,"Khách hàng",customer,"Sổ vỏ: "+kind+(note.isEmpty()?"":" · "+note));
        return q.customer(q.one("SELECT * FROM customers WHERE id=?",customer));
    }
    private Object createTrip(JsonNode d,long actor) {
        String driver=text(d,"driver",150,true),vehicle=text(d,"vehicle",40,false);
        check(d.path("orderIds").isArray() && !d.path("orderIds").isEmpty() && d.path("orderIds").size()<=200,"Chọn các đơn trong chuyến.");
        Set<String> codes=new TreeSet<>();d.path("orderIds").forEach(n->codes.add(n.asText()));List<Long> ids=new ArrayList<>();
        for(String code:codes) {
            var o=lockOrder(code);check("DELIVERY".equals(o.get("fulfillment_type")) && List.of("CONFIRMED","PREPARING").contains(str(o.get("status"))),"Đơn "+code+" chưa sẵn sàng giao.");
            long id=number(o.get("id"));check(db.queryForObject("SELECT count(*) FROM delivery_assignments WHERE order_id=? AND active",Long.class,id)==0,"Đơn đã nằm trong chuyến chưa đối soát.");ids.add(id);
        }
        long id=insert("INSERT INTO delivery_trips(driver_name,vehicle,created_by) VALUES (?,?,?) RETURNING id",driver,vehicle,actor);
        for(long order:ids) db.update("INSERT INTO delivery_assignments(trip_id,order_id) VALUES (?,?)",id,order);
        audit(actor,"Giao hàng",id,"Tạo chuyến cho "+driver);return q.trip(q.one("SELECT * FROM delivery_trips WHERE id=?",id));
    }
    private Map<String,Object> lockTrip(long id) { return q.one("SELECT * FROM delivery_trips WHERE id=? AND status<>'CANCELLED' FOR UPDATE",id); }
    private Object depart(long id,long actor) {
        var trip=lockTrip(id);check(trip.get("started_at")==null,"Chuyến đã xuất phát.");
        var codes=db.queryForList("SELECT o.order_code FROM orders o JOIN delivery_assignments a ON a.order_id=o.id WHERE a.trip_id=? ORDER BY o.id",String.class,id);
        check(!codes.isEmpty(),"Chuyến không có đơn.");
        for(String code:codes) {var o=lockOrder(code);check(List.of("CONFIRMED","PREPARING").contains(str(o.get("status"))),"Đơn "+code+" không còn chờ giao.");advance(o,actor);}
        db.update("UPDATE delivery_trips SET status='IN_PROGRESS',started_at=NOW() WHERE id=?",id);audit(actor,"Giao hàng",id,"Xuất phát chuyến giao");return q.trip(q.one("SELECT * FROM delivery_trips WHERE id=?",id));
    }
    private Object cancelTrip(long id,long actor) {
        var trip=lockTrip(id);check(trip.get("started_at")==null,"Chuyến đã xuất phát, cần ghi kết quả rồi đối soát.");
        db.update("UPDATE delivery_trips SET status='CANCELLED' WHERE id=?",id);db.update("UPDATE delivery_assignments SET active=false WHERE trip_id=?",id);audit(actor,"Giao hàng",id,"Hủy chuyến chưa xuất phát");return null;
    }
    private Object removeTripOrder(long id,String code,long actor) {
        var trip=lockTrip(id);check(trip.get("started_at")==null,"Chỉ sửa chuyến chưa xuất phát.");
        db.update("DELETE FROM delivery_assignments WHERE trip_id=? AND order_id=(SELECT id FROM orders WHERE order_code=?)",id,code);
        audit(actor,"Giao hàng",id,"Bỏ đơn "+code+" khỏi chuyến");
        if(db.queryForObject("SELECT count(*) FROM delivery_assignments WHERE trip_id=?",Long.class,id)==0) return cancelTrip(id,actor);
        return q.trip(trip);
    }
    private Object settle(long id,JsonNode d,long actor) {
        var trip=lockTrip(id);check(trip.get("started_at")!=null && !"COMPLETED".equals(trip.get("status")),"Chuyến chưa xuất phát hoặc đã đối soát.");
        check(db.queryForObject("SELECT count(*) FROM orders o JOIN delivery_assignments a ON a.order_id=o.id WHERE a.trip_id=? AND o.status='OUT_FOR_DELIVERY'",Long.class,id)==0,"Cần ghi kết quả của mọi đơn trước khi đối soát.");
        BigDecimal cash=money(d,"cashHandedOver",false);int bottles=integer(d,"bottlesHandedOver",0,1_000_000);String note=text(d,"note",2000,false);var expected=q.expected(id);
        boolean mismatch=cash.compareTo(amount(expected.get("cash")))!=0 || bottles!=number(expected.get("bottles"));check(!mismatch || !note.isEmpty(),"Ghi rõ lý do chênh lệch tiền/vỏ.");
        db.update("INSERT INTO handover_records(trip_id,driver_id,received_by,cash_reported,cash_confirmed,bottles_expected,bottles_confirmed,note) VALUES (?,?,?,?,?,?,?,?)",id,trip.get("driver_id"),actor,expected.get("cash"),cash,expected.get("bottles"),bottles,note);
        db.update("UPDATE delivery_trips SET status='COMPLETED',ended_at=NOW() WHERE id=?",id);db.update("UPDATE delivery_assignments SET active=false WHERE trip_id=?",id);
        audit(actor,"Giao hàng",id,"Đối soát chuyến: "+cash+" ₫, "+bottles+" vỏ"+(mismatch?" · Chênh lệch: "+note:""));return q.trip(q.one("SELECT * FROM delivery_trips WHERE id=?",id));
    }
    private Object settings(JsonNode d,long actor) {
        var values=map("storeName",text(d,"storeName",200,true),"address",text(d,"address",2000,true),"phone",phone(text(d,"phone",30,true)),
            "expiryWarningDays",integer(d,"expiryWarningDays",1,730),"defaultLowStock",integer(d,"defaultLowStock",0,1_000_000));
        for(String key:List.of("email","taxCode","bankName","bankAccount","bankHolder","invoiceNote")) values.put(key,text(d,key,key.equals("invoiceNote")?2000:254,false));
        check(str(values.get("taxCode")).isEmpty() || str(values.get("taxCode")).matches("[0-9]{10}(-[0-9]{3})?"),"Mã số thuế không hợp lệ.");
        db.update("UPDATE store_settings SET settings=?::jsonb,updated_by=?,updated_at=NOW() WHERE id=1",encode(values),actor);audit(actor,"Cài đặt",1,"Cập nhật thông tin cửa hàng");return values;
    }
}
