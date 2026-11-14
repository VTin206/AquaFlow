package com.aquaflow.report;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.UUID;
import java.util.List;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@Transactional
@EnabledIfEnvironmentVariable(named="DB_URL",matches=".+")
class ReportPostgresIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    long actor,product,second,customer,order,batch;
    static final String BASE="/api/v1/admin/reports";
    static final String RANGE="?from=2026-01-02&to=2026-01-02";
    static final Instant START=Instant.parse("2026-01-01T17:00:00Z");
    static final Instant END=START.plusSeconds(86400);
    Timestamp at(Instant value) { return Timestamp.from(value); }
    long product() { return jdbc.queryForObject("INSERT INTO products(sku,name,unit,sale_price,active) VALUES (?,'Report water','Bình',100,FALSE) RETURNING id",Long.class,UUID.randomUUID().toString()); }
    long order(String channel,String method,String status,int subtotal,int discount,int fee,Instant created,Instant delivered) {
        return jdbc.queryForObject("INSERT INTO orders(order_code,customer_id,channel,fulfillment_type,status,subtotal,discount_amount,delivery_fee,created_at,delivered_at) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id",
            Long.class,UUID.randomUUID().toString(),customer,channel,method,status,subtotal,discount,fee,at(created),delivered==null?null:at(delivered));
    }
    long item(long orderId,long productId,int qty,int price) {
        return jdbc.queryForObject("INSERT INTO order_items(order_id,product_id,quantity,unit_price,line_total) VALUES (?,?,?,?,?) RETURNING id",Long.class,orderId,productId,qty,price,qty*price);
    }
    void movement(String type,int quantity,Instant when) {
        jdbc.update("INSERT INTO inventory_movements(batch_id,movement_type,quantity,reference_type,reference_id,performed_by,occurred_at) VALUES (?,?,?,'ORDER',?,?,?)",batch,type,quantity,order,actor,at(when));
    }
    void payment(String method,String direction,int amount,String status,Instant when) {
        jdbc.update("INSERT INTO payments(order_id,direction,method,amount,status,recorded_by,confirmed_at) VALUES (?,?,?,?,?,?,?)",order,direction,method,amount,status,actor,at(when));
    }
    @BeforeEach void setup() {
        jdbc.update("INSERT INTO roles(code,name) VALUES ('ADMIN','Owner') ON CONFLICT(code) DO NOTHING");
        actor=jdbc.queryForObject("INSERT INTO users(role_id,full_name,email,password_hash) VALUES ((SELECT id FROM roles WHERE code='ADMIN'),'Report driver',?,'unused') RETURNING id",Long.class,UUID.randomUUID()+"@report.test");
        customer=jdbc.queryForObject("INSERT INTO customers(full_name) VALUES ('Report customer') RETURNING id",Long.class);
        jdbc.update("UPDATE customers SET created_at=? WHERE id=?",at(START),customer);
        product=product();second=product();
        order=order("PHONE","DELIVERY","DELIVERED",100,10,5,START,START);
        item(order,product,1,40);item(order,second,1,60);
        long counter=order("COUNTER","COUNTER","DELIVERED",20,0,0,START,null);
        item(counter,product,1,20);
        jdbc.update("INSERT INTO order_dispatches(order_id,performed_by,order_status,dispatched_at) VALUES (?,?,'DELIVERED',?)",counter,actor,at(END.minusSeconds(1)));
        long outside=order("PHONE","DELIVERY","DELIVERED",999,0,0,END,END);item(outside,product,1,999);
        long cancelled=order("PHONE","DELIVERY","CANCELLED",500,0,0,START,null);
        jdbc.update("UPDATE orders SET cancelled_at=? WHERE id=?",at(START),cancelled);
        long old=order("PHONE","DELIVERY","DELIVERED",20,2,0,START.minusSeconds(86400),START.minusSeconds(86400));
        long oldItem=item(old,product,2,10);
        long returned=jdbc.queryForObject("INSERT INTO order_returns(order_id,reason,restocked,performed_by,created_at) VALUES (?,'Report return',FALSE,?,?) RETURNING id",Long.class,old,actor,at(START));
        jdbc.update("INSERT INTO order_return_items(return_id,order_item_id,quantity) VALUES (?,?,1)",returned,oldItem);
        payment("CASH","IN",100,"CONFIRMED",START);payment("BANK_TRANSFER","IN",50,"CONFIRMED",START);
        payment("CASH","OUT",20,"CONFIRMED",START);payment("CASH","IN",999,"PENDING",START);
        payment("CASH","IN",123,"CONFIRMED",END);
        batch=jdbc.queryForObject("INSERT INTO product_batches(product_id,lot_code,expires_on) VALUES (?,'REPORT','2027-01-01') RETURNING id",Long.class,product);
        jdbc.update("INSERT INTO inventory_balances(batch_id,on_hand) VALUES (?,23)",batch);
        movement("RECEIVE",20,START.minusSeconds(1));movement("RECEIVE",5,START);movement("DISPATCH",4,START.plusSeconds(1));
        movement("RETURN",1,START.plusSeconds(2));movement("ADJUST_DOWN",2,START.plusSeconds(3));movement("RECEIVE",3,END);
        long trip=jdbc.queryForObject("INSERT INTO delivery_trips(driver_id,created_by,status) VALUES (?,?,'COMPLETED') RETURNING id",Long.class,actor,actor);
        long assignment=jdbc.queryForObject("INSERT INTO delivery_assignments(trip_id,order_id,active) VALUES (?,?,FALSE) RETURNING id",Long.class,trip,order);
        jdbc.update("INSERT INTO delivery_attempts(assignment_id,attempt_no,outcome,attempted_at) VALUES (?,1,'FAILED',?),(?,2,'SUCCESS',?)",assignment,at(START),assignment,at(START.plusSeconds(60)));
        jdbc.update("UPDATE orders SET requested_delivery_at=? WHERE id=?",at(START),order);
        jdbc.update("INSERT INTO handover_records(trip_id,driver_id,received_by,cash_reported,cash_confirmed,handed_over_at) VALUES (?,?,?,10,8,?)",trip,actor,actor,at(START));
    }
    @Test void summaryUsesVietnamBoundaryDiscountsCounterDispatchAndConfirmedPayments() throws Exception {
        mvc.perform(get(BASE+"/summary"+RANGE).with(user("owner").roles("ADMIN"))).andExpect(status().isOk())
            .andExpect(jsonPath("$.sales.ordersCreated").value(3)).andExpect(jsonPath("$.sales.ordersDelivered").value(2))
            .andExpect(jsonPath("$.sales.ordersCancelled").value(1)).andExpect(jsonPath("$.sales.revenue").value(101))
            .andExpect(jsonPath("$.sales.averageOrderValue").value(50.5)).andExpect(jsonPath("$.sales.newCustomers").value(1))
            .andExpect(jsonPath("$.sales.estimatedCost").value(0)).andExpect(jsonPath("$.sales.estimatedGrossProfit").value(101))
            .andExpect(jsonPath("$.sales.unpricedCostLines").value(3)).andExpect(jsonPath("$.sales.totalCostLines").value(3))
            .andExpect(jsonPath("$.sales.returnsValue").value(9)).andExpect(jsonPath("$.sales.netPayments").value(130))
            .andExpect(jsonPath("$.days.length()").value(1)).andExpect(jsonPath("$.days[0].date").value("2026-01-02"))
            .andExpect(jsonPath("$.days[0].revenue").value(101)).andExpect(jsonPath("$.days[0].collected").value(130));
        mvc.perform(get(BASE+"/summary"+RANGE+"&channel=COUNTER&method=COUNTER").with(user("owner").roles("ADMIN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.sales.revenue").value(20)).andExpect(jsonPath("$.sales.netPayments").value(0));
    }
    @Test void inventoryReconstructsBalancesAndIncludesInactiveProductsRegardlessOfChannel() throws Exception {
        mvc.perform(get(BASE+"/inventory"+RANGE+"&channel=WEB").with(user("owner").roles("ADMIN"))).andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].productId").value(product)).andExpect(jsonPath("$.content[0].opening").value(20))
            .andExpect(jsonPath("$.content[0].received").value(5)).andExpect(jsonPath("$.content[0].restocked").value(1))
            .andExpect(jsonPath("$.content[0].issued").value(4)).andExpect(jsonPath("$.content[0].adjustments").value(-2))
            .andExpect(jsonPath("$.content[0].closing").value(20));
    }
    @Test void productsCustomersAndDeliveryAreAggregatedWithoutJoinMultiplication() throws Exception {
        mvc.perform(get(BASE+"/products"+RANGE+"&size=1&page=0").with(user("owner").roles("ADMIN"))).andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.content[0].productId").value(second))
            .andExpect(jsonPath("$.content[0].revenue").value(54));
        mvc.perform(get(BASE+"/products"+RANGE+"&size=1&page=1").with(user("owner").roles("ADMIN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].revenue").value(47));
        mvc.perform(get(BASE+"/customers"+RANGE).with(user("owner").roles("ADMIN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].revenue").value(101)).andExpect(jsonPath("$.content[0].orders").value(2))
            .andExpect(jsonPath("$.content[0].lastOrder").value("2026-01-02")).andExpect(jsonPath("$.content[0].daysSinceLastOrder").value(0));
        mvc.perform(get(BASE+"/delivery"+RANGE).with(user("owner").roles("ADMIN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].delivered").value(1))
            .andExpect(jsonPath("$.content[0].failed").value(1)).andExpect(jsonPath("$.content[0].ordersSucceeded").value(1))
            .andExpect(jsonPath("$.content[0].ordersFailed").value(0)).andExpect(jsonPath("$.content[0].successRate").value(100))
            .andExpect(jsonPath("$.content[0].redeliveredOrders").value(1)).andExpect(jsonPath("$.content[0].late").value(1))
            .andExpect(jsonPath("$.content[0].cashDifference").value(2));
    }
    @Test void emptyPeriodsHaveZeroDailyBucketsAndNoEstimatedNumbers() throws Exception {
        mvc.perform(get(BASE+"/summary?from=2025-12-01&to=2025-12-02").with(user("owner").roles("ADMIN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.sales.revenue").value(0)).andExpect(jsonPath("$.days.length()").value(2))
            .andExpect(jsonPath("$.days[0].collected").value(0));
    }
    long receipt(long supplier, String status, Instant when, int cost, int accepted) {
        long receipt=jdbc.queryForObject("INSERT INTO purchase_receipts(supplier_id,status,created_by,confirmed_at) VALUES (?,?,?,?) RETURNING id",Long.class,supplier,status,actor,at(when));
        jdbc.update("INSERT INTO purchase_items(receipt_id,product_id,quantity_received,quantity_accepted,unit_cost) VALUES (?,?,1,?,?)",receipt,product,accepted,cost);
        return receipt;
    }
    com.fasterxml.jackson.databind.JsonNode inventoryRow(String range) throws Exception {
        var result=mvc.perform(get(BASE+"/inventory"+range+"&size=100").with(user("owner").roles("ADMIN")))
            .andExpect(status().isOk()).andReturn();
        var content=new com.fasterxml.jackson.databind.ObjectMapper().readTree(result.getResponse().getContentAsString()).get("content");
        for(var row:content) if(row.get("productId").asLong()==product) return row;
        throw new AssertionError("Fixture product missing from inventory report");
    }
    @Test void inventoryValuesUseLatestAcceptedConfirmedCostAtPeriodEndNotFutureOrDraft() throws Exception {
        long supplier=jdbc.queryForObject("INSERT INTO suppliers(name) VALUES ('Report supplier') RETURNING id",Long.class);
        receipt(supplier,"CONFIRMED",START.minusSeconds(10),7,1);
        receipt(supplier,"CONFIRMED",START.plusSeconds(10),11,1);
        receipt(supplier,"CONFIRMED",START.plusSeconds(10),12,1); // Stable tie: latest receipt ID.
        receipt(supplier,"DRAFT",START.plusSeconds(20),99,1);
        receipt(supplier,"CONFIRMED",START.plusSeconds(30),88,0);
        receipt(supplier,"CONFIRMED",END,77,1); // Next day in Vietnam: excluded.
        mvc.perform(get(BASE+"/inventory"+RANGE).with(user("owner").roles("ADMIN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].closing").value(20))
            .andExpect(jsonPath("$.content[0].latestUnitCost").value(12))
            .andExpect(jsonPath("$.content[0].closingValue").value(240));
        var historical=inventoryRow("?from=2026-01-01&to=2026-01-01");
        org.assertj.core.api.Assertions.assertThat(historical.get("latestUnitCost").decimalValue()).isEqualByComparingTo("7");
        org.assertj.core.api.Assertions.assertThat(historical.get("closingValue").decimalValue()).isEqualByComparingTo("140");
    }
    @Test void missingCostIsUnknownAndEmptyStockHasZeroValue() throws Exception {
        mvc.perform(get(BASE+"/inventory"+RANGE).with(user("owner").roles("ADMIN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].latestUnitCost").isEmpty())
            .andExpect(jsonPath("$.content[0].closingValue").isEmpty());
        var historical=inventoryRow("?from=2025-12-01&to=2025-12-02");
        org.assertj.core.api.Assertions.assertThat(historical.get("closing").asInt()).isZero();
        org.assertj.core.api.Assertions.assertThat(historical.get("closingValue").decimalValue()).isZero();
    }
    @Test void redeliveryCountsAcrossAssignmentsAndPreviousPeriodsWithEndExclusive() throws Exception {
        long trip=jdbc.queryForObject("INSERT INTO delivery_trips(driver_id,created_by,status) VALUES (?,?,'COMPLETED') RETURNING id",Long.class,actor,actor);
        long assignment=jdbc.queryForObject("INSERT INTO delivery_assignments(trip_id,order_id,active) VALUES (?,?,FALSE) RETURNING id",Long.class,trip,order);
        jdbc.update("INSERT INTO delivery_attempts(assignment_id,attempt_no,outcome,attempted_at) VALUES (?,1,'FAILED',?),(?,2,'FAILED',?)",assignment,at(START.minusSeconds(1)),assignment,at(END));
        // Both existing in-period attempts are retries even though one has attempt_no=1.
        mvc.perform(get(BASE+"/delivery"+RANGE).with(user("owner").roles("ADMIN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].redelivered").value(2))
            .andExpect(jsonPath("$.content[0].delivered").value(1)).andExpect(jsonPath("$.content[0].failed").value(1));
        mvc.perform(get(BASE+"/delivery"+RANGE+"&channel=WEB").with(user("owner").roles("ADMIN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].redelivered").value(0));
        mvc.perform(get(BASE+"/delivery?from=2025-12-01&to=2025-12-02").with(user("owner").roles("ADMIN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty());
    }
    @Test void inventoryAndDeliveryAreAdminOnlyAndValidateDates() throws Exception {
        for(String section:List.of("inventory","delivery")) {
            mvc.perform(get(BASE+"/"+section+RANGE)).andExpect(status().isUnauthorized());
            for(String role:List.of("CUSTOMER","SALES_STAFF","DELIVERY_STAFF"))
                mvc.perform(get(BASE+"/"+section+RANGE).with(user("staff").roles(role))).andExpect(status().isForbidden());
            for(String range:List.of("?from=2026-01-03&to=2026-01-02", "?from=2024-01-01&to=2026-01-02", "?from=2999-01-01&to=2999-01-02"))
                mvc.perform(get(BASE+"/"+section+range).with(user("owner").roles("ADMIN"))).andExpect(status().isBadRequest());
            mvc.perform(post(BASE+"/"+section+RANGE).with(user("owner").roles("ADMIN"))).andExpect(status().isMethodNotAllowed());
        }
    }
    @Test void reportsAreAdminReadOnlyAndRejectInvalidFilters() throws Exception {
        mvc.perform(get(BASE+"/summary"+RANGE)).andExpect(status().isUnauthorized());
        for(String role:List.of("CUSTOMER","SALES_STAFF","DELIVERY_STAFF"))
            mvc.perform(get(BASE+"/summary"+RANGE).with(user("staff").roles(role))).andExpect(status().isForbidden());
        for(String suffix:List.of("", "?from=bad&to=2026-01-02", "?from=2026-01-03&to=2026-01-02", "?from=2024-01-01&to=2026-01-02", RANGE+"&channel=HACK",RANGE+"&method=HACK"))
            mvc.perform(get(BASE+"/summary"+suffix).with(user("owner").roles("ADMIN"))).andExpect(status().isBadRequest());
        for(String filter:List.of("&size=101","&size=0","&page=-1"))
            mvc.perform(get(BASE+"/products"+RANGE+filter).with(user("owner").roles("ADMIN"))).andExpect(status().isBadRequest());
        mvc.perform(post(BASE+"/summary"+RANGE).with(user("owner").roles("ADMIN"))).andExpect(status().isMethodNotAllowed());
    }
}
