package com.aquaflow.bottle;

import com.aquaflow.bottle.BottleLedgerDtos.*;
import com.aquaflow.shared.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

@Repository
public class BottleLedgerRepository {
    private final JdbcTemplate jdbc;
    public BottleLedgerRepository(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    private static final String BALANCES = """
        SELECT c.id,c.full_name,c.active,COALESCE(b.held,0) held,COALESCE(b.liability,0) liability,COALESCE(d.held,0) deposit
        FROM customers c
        LEFT JOIN (SELECT customer_id,SUM(CASE WHEN movement IN ('GIVE','ADJUST_GIVE') THEN quantity ELSE -quantity END) held,
            GREATEST(SUM(liability_delta),0) liability FROM bottle_transactions GROUP BY customer_id) b ON b.customer_id=c.id
        LEFT JOIN (SELECT customer_id,SUM(CASE WHEN direction IN ('COLLECT','ADJUST_COLLECT') THEN amount ELSE -amount END) held
            FROM deposit_transactions GROUP BY customer_id) d ON d.customer_id=c.id
        """;
    private static final RowMapper<Balance> BALANCE = (r,n) -> new Balance(r.getLong("id"),r.getString("full_name"),r.getBoolean("active"),
            r.getLong("held"),r.getBigDecimal("deposit"),r.getBigDecimal("liability"),r.getBigDecimal("deposit").subtract(r.getBigDecimal("liability")).max(BigDecimal.ZERO));
    private static final RowMapper<Entry> ENTRY = (r,n) -> new Entry(r.getString("id"),r.getString("kind"),r.getString("type_name"),
            r.getLong("bottles"),r.getBigDecimal("deposit"),r.getString("note"),r.getString("actor"),r.getObject("at",OffsetDateTime.class));
    private static final String ENTRIES = """
        SELECT q.id::text id,q.kind,t.name type_name,q.bottles_delta bottles,q.deposit_delta deposit,q.note,u.full_name actor,q.created_at at
        FROM bottle_ledger_requests q LEFT JOIN bottle_types t ON t.id=q.bottle_type_id JOIN users u ON u.id=q.actor_id
        """;
    public void lockCustomer(long id) {
        if(jdbc.queryForList("SELECT id FROM customers WHERE id=? FOR UPDATE",Long.class,id).isEmpty()) throw new NotFoundException("Không tìm thấy khách hàng");
    }
    public List<Balance> balances() { return jdbc.query(BALANCES+" ORDER BY c.id DESC",BALANCE); }
    public Balance balance(long id) { return jdbc.query(BALANCES+" WHERE c.id=?",BALANCE,id).stream().findFirst().orElseThrow(()->new NotFoundException("Không tìm thấy khách hàng")); }
    public List<TypeBalance> types(long id) {
        return jdbc.query("""
            SELECT t.*,COALESCE(b.held,0) held,COALESCE(b.liability,0) liability FROM bottle_types t
            LEFT JOIN (SELECT bottle_type_id,SUM(CASE WHEN movement IN ('GIVE','ADJUST_GIVE') THEN quantity ELSE -quantity END) held,
                GREATEST(SUM(liability_delta),0) liability FROM bottle_transactions WHERE customer_id=? GROUP BY bottle_type_id) b ON b.bottle_type_id=t.id
            ORDER BY t.id
            """,(r,n)->new TypeBalance(r.getLong("id"),r.getString("name"),r.getBoolean("active"),r.getLong("held"),r.getBigDecimal("deposit_unit_amount"),r.getBigDecimal("liability")),id);
    }
    public List<Entry> entries(long id) {
        return jdbc.query(ENTRIES+" WHERE q.customer_id=? UNION ALL "+"""
            SELECT 'b-'||b.id,COALESCE(b.entry_kind,b.movement),t.name,
                CASE WHEN b.movement IN ('GIVE','ADJUST_GIVE') THEN b.quantity ELSE -b.quantity END,0,b.condition_note,u.full_name,b.occurred_at
            FROM bottle_transactions b JOIN bottle_types t ON t.id=b.bottle_type_id JOIN users u ON u.id=b.performed_by
            WHERE b.customer_id=? AND b.ledger_request_id IS NULL
            UNION ALL SELECT 'd-'||d.id,COALESCE(d.entry_kind,d.direction),NULL,0,
                CASE WHEN d.direction IN ('COLLECT','ADJUST_COLLECT') THEN d.amount ELSE -d.amount END,d.note,u.full_name,d.created_at
            FROM deposit_transactions d JOIN users u ON u.id=d.created_by WHERE d.customer_id=? AND d.ledger_request_id IS NULL
            ORDER BY at DESC,id DESC
            """,ENTRY,id,id,id);
    }
    public Entry detail(long customer,UUID id) { return jdbc.query(ENTRIES+" WHERE q.customer_id=? AND q.id=?",ENTRY,customer,id).stream().findFirst().orElseThrow(()->new NotFoundException("Không tìm thấy giao dịch")); }
    public Entry replay(long customer,long actor,Create input) {
        var rows=jdbc.queryForList("SELECT * FROM bottle_ledger_requests WHERE id=?",input.requestId());
        if(rows.isEmpty()) return null;
        var r=rows.getFirst();
        BigDecimal amount=(BigDecimal)r.get("amount");
        if(((Number)r.get("customer_id")).longValue()!=customer || ((Number)r.get("actor_id")).longValue()!=actor
                || !Objects.equals(r.get("kind"),input.kind()) || !Objects.equals(r.get("bottle_type_id"),input.bottleTypeId())
                || !Objects.equals(r.get("quantity"),input.quantity()) || !Objects.equals(r.get("note"),input.note())
                || (amount==null ? input.amount()!=null : input.amount()==null || amount.compareTo(input.amount())!=0))
            throw new ConflictException("Mã yêu cầu đã dùng cho giao dịch khác");
        return detail(customer,input.requestId());
    }
    public Entry insert(long customer,long actor,Create input,int bottles,BigDecimal deposit,BigDecimal liability) {
        jdbc.update("""
            INSERT INTO bottle_ledger_requests(id,customer_id,actor_id,kind,bottle_type_id,quantity,amount,note,bottles_delta,deposit_delta)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            """,input.requestId(),customer,actor,input.kind(),input.bottleTypeId(),input.quantity(),input.amount(),input.note(),bottles,deposit);
        Long bottleId=null;
        if(bottles!=0) bottleId=jdbc.queryForObject("""
            INSERT INTO bottle_transactions(customer_id,bottle_type_id,movement,quantity,condition_note,performed_by,entry_kind,ledger_request_id,liability_delta)
            VALUES (?,?,?,?,?,?,?,?,?) RETURNING id
            """,Long.class,customer,input.bottleTypeId(),bottles>0 ? "GIVE" : "RECEIVE",Math.abs(bottles),input.note(),actor,input.kind(),input.requestId(),liability);
        if(deposit.signum()!=0) jdbc.update("""
            INSERT INTO deposit_transactions(customer_id,bottle_transaction_id,direction,amount,created_by,entry_kind,note,ledger_request_id)
            VALUES (?,?,?,?,?,?,?,?)
            """,customer,bottleId,deposit.signum()>0 ? "COLLECT" : "REFUND",deposit.abs(),actor,input.kind(),input.note(),input.requestId());
        return detail(customer,input.requestId());
    }
}
