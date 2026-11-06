package com.aquaflow.payment;

import com.aquaflow.payment.PaymentDtos.Create;
import com.aquaflow.shared.api.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import java.math.BigDecimal;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named="DB_URL",matches=".+")
class PaymentIntegrationTest {
    @Autowired PaymentService service;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired PlatformTransactionManager manager;
    long actor, customer, order;
    @BeforeEach void setup() {
        actor=jdbc.queryForObject("INSERT INTO users(role_id,full_name,email,password_hash) VALUES ((SELECT id FROM roles WHERE code='ADMIN'),'Cashier',?,'unused') RETURNING id",Long.class,UUID.randomUUID()+"@payment.test");
        customer=jdbc.queryForObject("INSERT INTO customers(full_name) VALUES ('Payment customer') RETURNING id",Long.class);
        order=jdbc.queryForObject("INSERT INTO orders(order_code,customer_id,created_by,channel,fulfillment_type,status,subtotal) VALUES (?,?,?,'COUNTER','COUNTER','PREPARING',100000) RETURNING id",Long.class,UUID.randomUUID().toString(),customer,actor);
    }
    Create input(String amount,String direction) { return new Create(UUID.randomUUID(),new BigDecimal(amount),direction,"CASH",null,direction.equals("OUT") ? "Customer refund" : null); }
    String paymentStatus() { return jdbc.queryForObject("SELECT payment_status FROM orders WHERE id=?",String.class,order); }
    @Test void partialPaymentFullPaymentAndReplayAreConsistent() {
        var request=input("25000","IN");
        var receipt=service.create(order,actor,request);
        assertThat(service.create(order,actor,request).id()).isEqualTo(receipt.id());
        assertThat(paymentStatus()).isEqualTo("PARTIALLY_PAID");
        assertThat(service.payments(order).balance().due()).isEqualByComparingTo("75000");
        service.create(order,actor,input("75000","IN"));
        assertThat(paymentStatus()).isEqualTo("PAID");
        assertThat(service.payments(order).payments()).hasSize(2);
        assertThat(service.customers().stream().filter(c->c.customerId()==customer).findFirst().orElseThrow().due()).isZero();
        assertThatThrownBy(()->service.create(order,actor,new Create(request.requestId(),new BigDecimal("26000"),"IN","CASH",null,null))).isInstanceOf(ConflictException.class);
    }
    @Test void blocksOverpaymentAndUnconfirmedOrdersWithoutWriting() {
        assertThatThrownBy(()->service.create(order,actor,input("100001","IN"))).isInstanceOf(ConflictException.class);
        jdbc.update("UPDATE orders SET status='PENDING' WHERE id=?",order);
        assertThatThrownBy(()->service.create(order,actor,input("1","IN"))).isInstanceOf(ConflictException.class);
        assertThat(service.payments(order).payments()).isEmpty();
        assertThat(service.receivables(customer)).isEmpty();
    }
    @Test void cancelledOrdersHaveNoDebtAndRequireAppendOnlyRefunds() {
        service.create(order,actor,input("60000","IN"));
        assertThatThrownBy(()->service.create(order,actor,input("1","OUT"))).isInstanceOf(ConflictException.class);
        jdbc.update("UPDATE orders SET status='CANCELLED' WHERE id=?",order);
        assertThat(paymentStatus()).isEqualTo("REFUND_PENDING");
        assertThat(service.payments(order).balance().due()).isZero();
        assertThat(service.payments(order).balance().refundDue()).isEqualByComparingTo("60000");
        assertThatThrownBy(()->service.create(order,actor,input("60001","OUT"))).isInstanceOf(ConflictException.class);
        assertThatThrownBy(()->service.create(order,actor,new Create(UUID.randomUUID(),BigDecimal.ONE,"OUT","CASH",null,null))).isInstanceOf(BadRequestException.class);
        service.create(order,actor,input("20000","OUT"));
        service.create(order,actor,input("40000","OUT"));
        assertThat(paymentStatus()).isEqualTo("REFUNDED");
        assertThat(service.payments(order).payments()).hasSize(3);
        jdbc.update("UPDATE orders SET status='PREPARING' WHERE id=?",order);
        assertThat(paymentStatus()).isEqualTo("UNPAID");
        assertThat(service.payments(order).balance().due()).isEqualByComparingTo("100000");
    }
    @Test void concurrentReceiptsCannotExceedDebt() throws Exception {
        var barrier=new CyclicBarrier(2);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Boolean> action=()->{ barrier.await(); try { service.create(order,actor,input("70000","IN")); return true; } catch(ConflictException e) { return false; } };
            var a=pool.submit(action); var b=pool.submit(action);
            assertThat(java.util.List.of(a.get(10,TimeUnit.SECONDS),b.get(10,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
        assertThat(service.payments(order).balance().paid()).isEqualByComparingTo("70000");
    }
    @Test void outerTransactionRollbackRemovesReceiptAndRestoresBalance() {
        new TransactionTemplate(manager).executeWithoutResult(tx->{ service.create(order,actor,input("10000","IN")); tx.setRollbackOnly(); });
        assertThat(service.payments(order).payments()).isEmpty();
        assertThat(paymentStatus()).isEqualTo("UNPAID");
        assertThat(service.payments(order).balance().due()).isEqualByComparingTo("100000");
    }
    @Test void archivedCustomersRetainDebtAndDepositsAreNotSalePayments() {
        service.create(order,actor,input("20000","IN"));
        jdbc.update("UPDATE customers SET active=false WHERE id=?",customer);
        long deposit=jdbc.queryForObject("INSERT INTO payments(order_id,direction,method,amount,status,recorded_by) VALUES (?,'IN','CASH',999999,'CONFIRMED',?) RETURNING id",Long.class,order,actor);
        jdbc.update("INSERT INTO payment_allocations(payment_id,allocation_type,amount) VALUES (?,'DEPOSIT',999999)",deposit);
        var summary=service.customers().stream().filter(c->c.customerId()==customer).findFirst().orElseThrow();
        assertThat(summary.active()).isFalse(); assertThat(summary.due()).isEqualByComparingTo("80000");
        assertThat(service.receivables(customer)).hasSize(1);
        assertThat(service.payments(order).payments()).hasSize(1);
    }
    @Test void onlyOfficeStaffCanReadAndWriteAndAmountsAreValidated() throws Exception {
        String path="/api/v1/sales/orders/"+order+"/payments";
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        for(String role:java.util.List.of("CUSTOMER","DELIVERY_STAFF")) {
            mvc.perform(get(path).with(user("test").roles(role))).andExpect(status().isForbidden());
            mvc.perform(post(path).with(user("test").roles(role)).contentType("application/json").content("{}" )).andExpect(status().isForbidden());
        }
        mvc.perform(get(path).with(user("test").roles("SALES_STAFF"))).andExpect(status().isOk());
        mvc.perform(post(path).with(user("test").roles("ADMIN")).contentType("application/json")
                .content("{\"requestId\":\""+UUID.randomUUID()+"\",\"amount\":-1,\"direction\":\"IN\",\"method\":\"CASH\"}"))
                .andExpect(status().isBadRequest());
    }
}
