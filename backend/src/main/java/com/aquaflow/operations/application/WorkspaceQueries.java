package com.aquaflow.operations.application;

import com.aquaflow.shared.api.NotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import static com.aquaflow.operations.application.WorkspaceData.*;

@Service
@Transactional(readOnly = true)
public class WorkspaceQueries {
    final JdbcTemplate db;
    public WorkspaceQueries(JdbcTemplate db) { this.db=db; }
    Map<String,Object> one(String sql,Object... args) {
        var rows=db.queryForList(sql,args);
        if(rows.isEmpty()) throw new NotFoundException("Không tìm thấy bản ghi.");
        return rows.getFirst();
    }
    public Object read(String resource,String action,com.fasterxml.jackson.databind.JsonNode args) {
        return switch(resource+"/"+action) {
            case "products/list" -> products();
            case "products/lots" -> lots();
            case "products/receipts" -> receipts();
            case "orders/list" -> orders();
            case "customers/list" -> customers();
            case "customers/ledger" -> ledger(id(args.path(0)));
            case "suppliers/list" -> suppliers();
            case "trips/list" -> trips();
            case "settings/get" -> settings();
            case "activity/list" -> activity();
            case "reports/data" -> map("orders",orders(),"archivedOrders",List.of(),"products",products(),
                "lots",lots(),"receipts",receipts(),"bottleLedger",ledger(null));
            default -> throw new NotFoundException("Chức năng không tồn tại.");
        };
    }
    public Object settings() { return json(one("SELECT settings FROM store_settings WHERE id=1").get("settings")); }
    public List<Map<String,Object>> products() {
        return db.queryForList("""
            SELECT p.*, COALESCE((SELECT sum(i.on_hand-i.reserved) FROM inventory_balances i JOIN product_batches b ON b.id=i.batch_id
                WHERE b.product_id=p.id AND b.expires_on >= CURRENT_DATE),0) AS stock,
                (SELECT min(b.expires_on) FROM product_batches b JOIN inventory_balances i ON i.batch_id=b.id
                WHERE b.product_id=p.id AND i.on_hand-i.reserved>0) AS expiry
            FROM products p WHERE p.active ORDER BY p.id
            """).stream().map(p -> map("id",str(p.get("id")),"sku",p.get("sku"),"name",p.get("name"),"brand",str(p.get("brand")),
                "unit",p.get("unit"),"price",p.get("sale_price"),"stock",p.get("stock"),"threshold",p.get("low_stock_threshold"),
                "image",p.get("image"),"catalog",json(p.get("catalog")),"expiry",p.get("expiry")==null || "Vỏ".equals(p.get("unit"))?"—":
                LocalDate.parse(p.get("expiry").toString()).format(DateTimeFormatter.ofPattern("dd/MM/yyyy")))).toList();
    }
    Map<String,Object> product(long id) { return products().stream().filter(p->str(p.get("id")).equals(""+id)).findFirst().orElseThrow(()->new NotFoundException("Không tìm thấy sản phẩm.")); }
    public List<Map<String,Object>> suppliers() {
        return db.queryForList("SELECT * FROM suppliers WHERE active ORDER BY id DESC").stream().map(p->map("id",str(p.get("id")),
            "name",p.get("name"),"phone",str(p.get("phone")),"address",str(p.get("address")),"contactName",p.get("contact_name"),"email",p.get("email"))).toList();
    }
    public List<Map<String,Object>> lots() {
        return db.queryForList("""
            SELECT b.*,i.on_hand,i.reserved,
                COALESCE((SELECT sum(pi.quantity_accepted) FROM purchase_items pi JOIN purchase_receipts pr ON pr.id=pi.receipt_id WHERE pi.batch_id=b.id AND pr.status='CONFIRMED'),i.on_hand) AS received,
                COALESCE((SELECT sum(pi.unit_cost*pi.quantity_accepted)/NULLIF(sum(pi.quantity_accepted),0) FROM purchase_items pi JOIN purchase_receipts pr ON pr.id=pi.receipt_id WHERE pi.batch_id=b.id AND pr.status='CONFIRMED'),0) AS cost,
                (SELECT min(pi.receipt_id) FROM purchase_items pi WHERE pi.batch_id=b.id) AS receipt_id
            FROM product_batches b JOIN inventory_balances i ON i.batch_id=b.id ORDER BY b.expires_on,b.id
            """).stream().map(b->map("id",str(b.get("id")),"productId",str(b.get("product_id")),"lotCode",b.get("lot_code"),
                "mfgDate",b.get("manufactured_on")==null?null:b.get("manufactured_on").toString(),"expiryDate",b.get("expires_on").toString(),
                "received",b.get("received"),"remaining",number(b.get("on_hand"))-number(b.get("reserved")),"costPrice",b.get("cost"),
                "receiptId",str(b.get("receipt_id")),"receivedAt",iso(b.get("created_at")).substring(0,10))).toList();
    }
    public List<Map<String,Object>> receipts() {
        return db.queryForList("SELECT r.*,s.name AS supplier_name,u.full_name AS actor FROM purchase_receipts r JOIN suppliers s ON s.id=r.supplier_id JOIN users u ON u.id=r.created_by WHERE r.status='CONFIRMED' ORDER BY r.received_at DESC,r.id DESC")
            .stream().map(r->{
                var lines=db.queryForList("SELECT i.*,p.name,p.unit,b.lot_code,b.manufactured_on,b.expires_on FROM purchase_items i JOIN products p ON p.id=i.product_id LEFT JOIN product_batches b ON b.id=i.batch_id WHERE i.receipt_id=? ORDER BY i.id",r.get("id"))
                    .stream().map(i->map("productId",str(i.get("product_id")),"productName",i.get("name"),"unit",i.get("unit"),"lotCode",i.get("lot_code"),
                        "mfgDate",i.get("manufactured_on")==null?null:i.get("manufactured_on").toString(),"expiryDate",i.get("expires_on")==null?null:i.get("expires_on").toString(),
                        "received",i.get("quantity_received"),"damaged",number(i.get("quantity_received"))-number(i.get("quantity_accepted")),"costPrice",i.get("unit_cost"))).toList();
                BigDecimal total=lines.stream().map(l->amount(l.get("costPrice")).multiply(BigDecimal.valueOf(number(l.get("received"))-number(l.get("damaged"))))).reduce(BigDecimal.ZERO,BigDecimal::add);
                return map("id",str(r.get("id")),"supplierId",str(r.get("supplier_id")),"supplierName",r.get("supplier_name"),
                    "receivedAt",iso(r.get("received_at")).substring(0,10),"receiver",r.get("receiver_name")==null?r.get("actor"):r.get("receiver_name"),"note",r.get("note"),"lines",lines,"total",total);
            }).toList();
    }
    static String status(Map<String,Object> row) {
        if(Boolean.TRUE.equals(row.get("delivery_failed"))) return "Giao thất bại";
        return switch(str(row.get("status"))) {
            case "PENDING" -> "Chờ xác nhận";
            case "CONFIRMED","PREPARING" -> "Đang chuẩn bị";
            case "OUT_FOR_DELIVERY" -> "Đang giao";
            case "DELIVERED" -> "Đã giao";
            case "COMPLETED" -> "Đã hoàn tất";
            case "CANCELLED" -> "Đã hủy";
            default -> throw new IllegalStateException("Unknown order status");
        };
    }
    BigDecimal paid(long id) { return db.queryForObject("SELECT COALESCE(sum(CASE WHEN direction='IN' THEN amount ELSE -amount END),0) FROM payments WHERE order_id=? AND status='CONFIRMED'",BigDecimal.class,id); }
    BigDecimal returned(long id) { return db.queryForObject("SELECT COALESCE(sum(ri.quantity*i.unit_price),0) FROM order_return_items ri JOIN order_returns r ON r.id=ri.return_id JOIN order_items i ON i.id=ri.order_item_id WHERE r.order_id=?",BigDecimal.class,id); }
    BigDecimal total(Map<String,Object> row) { return amount(row.get("subtotal")).add(amount(row.get("delivery_fee"))).subtract(amount(row.get("discount_amount"))).subtract(returned(number(row.get("id")))); }
    public List<Map<String,Object>> orders() { return db.queryForList("SELECT * FROM orders ORDER BY created_at DESC,id DESC").stream().map(this::order).toList(); }
    Map<String,Object> orderById(long id) { return order(one("SELECT * FROM orders WHERE id=?",id)); }
    Map<String,Object> order(Map<String,Object> o) {
        long id=number(o.get("id"));
        var lines=db.queryForList("SELECT i.*,p.name,p.unit FROM order_items i JOIN products p ON p.id=i.product_id WHERE i.order_id=? ORDER BY i.id",id)
            .stream().map(i->map("productId",str(i.get("product_id")),"name",i.get("name"),"unit",i.get("unit"),"quantity",i.get("quantity"),"unitPrice",i.get("unit_price"))).toList();
        var payments=db.queryForList("SELECT p.*,u.full_name AS actor FROM payments p JOIN users u ON u.id=p.recorded_by WHERE p.order_id=? AND p.status='CONFIRMED' ORDER BY p.id",id)
            .stream().map(p->map("id",str(p.get("id")),"amount",p.get("amount"),"method","CASH".equals(p.get("method"))?"Tiền mặt":"Chuyển khoản",
                "reference",p.get("external_reference"),"refund","OUT".equals(p.get("direction")),"recordedAt",iso(p.get("created_at")),"by",p.get("actor"))).toList();
        List<Map<String,Object>> history=new ArrayList<>();
        history.add(map("at",iso(o.get("created_at")),"message","Tiếp nhận đơn hàng"));
        db.queryForList("SELECT a.*,u.full_name AS actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id WHERE a.entity_type='Đơn hàng' AND a.entity_id=? ORDER BY a.id",id)
            .forEach(h->history.add(map("at",iso(h.get("created_at")),"message",h.get("reason"),"by",h.get("actor"))));
        var returns=db.queryForList("SELECT r.*,u.full_name AS actor FROM order_returns r JOIN users u ON u.id=r.performed_by WHERE r.order_id=? ORDER BY r.id",id)
            .stream().map(r->map("id",str(r.get("id")),"at",iso(r.get("created_at")),"by",r.get("actor"),"reason",r.get("reason"),"restocked",r.get("restocked"),"refunded",r.get("refunded"),
                "lines",db.queryForList("SELECT ri.quantity,i.product_id,i.unit_price,p.name,p.unit FROM order_return_items ri JOIN order_items i ON i.id=ri.order_item_id JOIN products p ON p.id=i.product_id WHERE ri.return_id=?",r.get("id"))
                    .stream().map(i->map("productId",str(i.get("product_id")),"name",i.get("name"),"unit",i.get("unit"),"quantity",i.get("quantity"),"unitPrice",i.get("unit_price"))).toList())).toList();
        long given=db.queryForObject("SELECT COALESCE(sum(quantity),0) FROM bottle_transactions WHERE order_id=? AND movement='GIVE'",Long.class,id);
        long received=db.queryForObject("SELECT COALESCE(sum(quantity),0) FROM bottle_transactions WHERE order_id=? AND movement='RECEIVE'",Long.class,id);
        BigDecimal deposit=db.queryForObject("SELECT COALESCE(sum(amount),0) FROM deposit_transactions WHERE order_id=? AND direction='COLLECT'",BigDecimal.class,id);
        String summary=lines.stream().map(l->l.get("quantity")+" "+l.get("unit")+" "+l.get("name")).reduce((a,b)->a+", "+b).orElse("");
        return map("id",o.get("order_code"),"customerId",o.get("customer_id")==null?null:str(o.get("customer_id")),"customer",o.get("recipient_name")==null?"Khách vãng lai":o.get("recipient_name"),
            "phone",str(o.get("recipient_phone")),"address",o.get("delivery_address")==null?"Nhận tại cửa hàng":o.get("delivery_address"),"items",summary,"total",total(o),
            "time",Instant.parse(iso(o.get("created_at"))).atZone(ZONE).format(DateTimeFormatter.ofPattern("HH:mm")),"status",status(o),
            "method","COUNTER".equals(o.get("fulfillment_type"))?"Tại quầy":"Giao tận nơi", "channel",switch(str(o.get("channel"))) {case "WEB"->"Website";case "COUNTER"->"Tại quầy";case "MESSAGE"->"Tin nhắn";default->"Điện thoại";},
            "lines",lines,"deliveryFee",o.get("delivery_fee"),"floor",o.get("delivery_floor"),"appointment",iso(o.get("requested_delivery_at")),"note",o.get("note"),"payments",payments,"history",history,
            "stockReserved",List.of("CONFIRMED","PREPARING","OUT_FOR_DELIVERY").contains(str(o.get("status"))),"bottles",map("delivered",given,"returned",received,"deposit",deposit),
            "deliveredAt",iso(o.get("delivered_at")),"returns",returns,"trackingToken",o.get("tracking_token"));
    }
    List<Map<String,Object>> ledger(Long customerId) {
        String filter=customerId==null?"":" AND t.customer_id=?";
        Object[] args=customerId==null?new Object[]{}:new Object[]{customerId};
        List<Map<String,Object>> entries=new ArrayList<>();
        db.queryForList("SELECT t.*,u.full_name AS actor,o.order_code FROM bottle_transactions t JOIN users u ON u.id=t.performed_by LEFT JOIN orders o ON o.id=t.order_id WHERE true"+filter,args)
            .forEach(t->entries.add(map("id","B-"+t.get("id"),"customerId",str(t.get("customer_id")),"at",iso(t.get("occurred_at")),"kind",t.get("entry_kind")==null?(str(t.get("movement")).contains("RECEIVE")?"Thu vỏ":"Giao kèm đơn"):t.get("entry_kind"),
                "bottles",number(t.get("quantity"))*(str(t.get("movement")).contains("RECEIVE")?-1:1),"deposit",0,"orderId",t.get("order_code"),"note",t.get("condition_note"),"by",t.get("actor"))));
        db.queryForList("SELECT t.*,u.full_name AS actor,o.order_code FROM deposit_transactions t JOIN users u ON u.id=t.created_by LEFT JOIN orders o ON o.id=t.order_id WHERE true"+filter,args)
            .forEach(t->entries.add(map("id","D-"+t.get("id"),"customerId",str(t.get("customer_id")),"at",iso(t.get("created_at")),"kind",t.get("entry_kind")==null?(str(t.get("direction")).contains("REFUND")?"Hoàn cọc":"Thu cọc"):t.get("entry_kind"),
                "bottles",0,"deposit",amount(t.get("amount")).multiply(BigDecimal.valueOf(str(t.get("direction")).contains("REFUND")?-1:1)),"orderId",t.get("order_code"),"note",t.get("note"),"by",t.get("actor"))));
        entries.sort(Comparator.comparing(e->str(e.get("at")),Comparator.reverseOrder()));
        return entries;
    }
    Map<String,Object> balance(long customerId) {
        var rows=ledger(customerId);
        return map("bottles",rows.stream().mapToLong(r->number(r.get("bottles"))).sum(),"deposit",rows.stream().map(r->amount(r.get("deposit"))).reduce(BigDecimal.ZERO,BigDecimal::add));
    }
    public List<Map<String,Object>> customers() { return db.queryForList("SELECT * FROM customers WHERE active ORDER BY id DESC").stream().map(this::customer).toList(); }
    Map<String,Object> customer(Map<String,Object> c) {
        long id=number(c.get("id")); var balance=balance(id);
        var orders=db.queryForList("SELECT * FROM orders WHERE customer_id=? AND status<>'CANCELLED'",id);
        BigDecimal debt=orders.stream().map(o->total(o).subtract(paid(number(o.get("id")))).max(BigDecimal.ZERO)).reduce(BigDecimal.ZERO,BigDecimal::add);
        String name=str(c.get("full_name"));String[] parts=name.trim().split("\\s+");
        String initials=parts.length>1?parts[parts.length-2].substring(0,1)+parts[parts.length-1].substring(0,1):name.substring(0,Math.min(2,name.length()));
        return map("id",str(id),"name",name,"phone",str(c.get("phone")),"type",c.get("customer_type"),"area",str(c.get("area")),"note",c.get("note"),"legacyOrders",0,
            "addresses",db.queryForList("SELECT address_line FROM customer_addresses WHERE customer_id=? ORDER BY is_default DESC,id",String.class,id),"initials",initials.toUpperCase(Locale.ROOT),"orders",orders.size(),
            "bottlesHeld",balance.get("bottles"),"depositHeld",balance.get("deposit"),"debt",debt);
    }
    public List<Map<String,Object>> activity() {
        return db.queryForList("SELECT a.*,u.full_name AS actor,o.order_code FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN orders o ON a.entity_type='Đơn hàng' AND o.id=a.entity_id ORDER BY a.id DESC")
            .stream().map(a->map("id",str(a.get("id")),"at",iso(a.get("created_at")),"by",a.get("actor")==null?"Hệ thống":a.get("actor"),
                "area",a.get("entity_type"),"target",a.get("order_code")==null?str(a.get("entity_id")):a.get("order_code"),"action",a.get("reason")==null?a.get("action"):a.get("reason"))).toList();
    }
    Map<String,Object> expected(long tripId) {
        var t=one("SELECT * FROM delivery_trips WHERE id=?",tripId);
        Object since=t.get("started_at")==null?t.get("created_at"):t.get("started_at");
        BigDecimal cash=db.queryForObject("SELECT COALESCE(sum(CASE WHEN p.direction='IN' THEN p.amount ELSE -p.amount END),0) FROM payments p JOIN delivery_assignments a ON a.order_id=p.order_id WHERE a.trip_id=? AND p.created_at>=? AND p.status='CONFIRMED' AND p.method='CASH'",BigDecimal.class,tripId,since);
        BigDecimal deposit=db.queryForObject("SELECT COALESCE(sum(CASE WHEN d.direction='COLLECT' THEN d.amount ELSE -d.amount END),0) FROM deposit_transactions d JOIN delivery_assignments a ON a.order_id=d.order_id WHERE a.trip_id=? AND d.created_at>=?",BigDecimal.class,tripId,since);
        Long bottles=db.queryForObject("SELECT COALESCE(sum(b.quantity),0) FROM bottle_transactions b JOIN delivery_assignments a ON a.order_id=b.order_id WHERE a.trip_id=? AND b.occurred_at>=? AND b.movement='RECEIVE'",Long.class,tripId,since);
        return map("cash",cash.add(deposit),"bottles",bottles);
    }
    public List<Map<String,Object>> trips() { return db.queryForList("SELECT * FROM delivery_trips WHERE status<>'CANCELLED' ORDER BY id DESC").stream().map(this::trip).toList(); }
    Map<String,Object> trip(Map<String,Object> t) {
        long id=number(t.get("id"));
        var orders=db.queryForList("SELECT o.order_code,o.status FROM orders o JOIN delivery_assignments a ON a.order_id=o.id WHERE a.trip_id=? ORDER BY a.id",id);
        var settlements=db.queryForList("SELECT h.*,u.full_name AS actor FROM handover_records h JOIN users u ON u.id=h.received_by WHERE h.trip_id=?",id);
        Map<String,Object> settlement=null;
        if(!settlements.isEmpty()) {var h=settlements.getFirst();settlement=map("cashExpected",h.get("cash_reported"),"cashHandedOver",h.get("cash_confirmed"),"bottlesExpected",h.get("bottles_expected"),"bottlesHandedOver",h.get("bottles_confirmed"),"note",h.get("note"),"settledAt",iso(h.get("handed_over_at")),"settledBy",h.get("actor"));}
        String state=settlement!=null?"Đã đối soát":t.get("started_at")==null?"Chờ xuất phát":orders.stream().anyMatch(o->"OUT_FOR_DELIVERY".equals(o.get("status")))?"Đang giao":"Chờ đối soát";
        return map("id",str(id),"driver",t.get("driver_name"),"vehicle",t.get("vehicle"),"orderIds",orders.stream().map(o->o.get("order_code")).toList(),"createdAt",iso(t.get("created_at")),"departedAt",iso(t.get("started_at")),"settlement",settlement,"status",state,"expected",expected(id));
    }
}
