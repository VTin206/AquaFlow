package com.aquaflow.bottle;

import com.aquaflow.bottle.BottleLedgerDtos.*;
import com.aquaflow.shared.api.*;
import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.auth.security.AuthUserDetails;
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
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named="DB_URL",matches=".+")
class BottleLedgerIntegrationTest {
    @Autowired BottleLedgerService service;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired com.aquaflow.report.ReportRepository reports;
    @Autowired PlatformTransactionManager manager;
    long customer,actor,type;
    @BeforeEach void setup() {
        jdbc.update("INSERT INTO roles(code,name) VALUES ('ADMIN','Admin'),('SALES_STAFF','Sales') ON CONFLICT(code) DO NOTHING");
        actor=jdbc.queryForObject("INSERT INTO users(role_id,full_name,email,password_hash) VALUES ((SELECT id FROM roles WHERE code='ADMIN'),'Bottle admin',?,'unused') RETURNING id",Long.class,UUID.randomUUID()+"@bottle.test");
        customer=jdbc.queryForObject("INSERT INTO customers(full_name) VALUES ('Bottle customer') RETURNING id",Long.class);
        type=jdbc.queryForObject("INSERT INTO bottle_types(name,deposit_unit_amount) VALUES (?,50000) RETURNING id",Long.class,"Bottle-"+UUID.randomUUID());
    }
    Create bottles(String kind,int quantity) { return new Create(UUID.randomUUID(),kind,type,quantity,null,"Actual handover"); }
    Create money(String kind,String amount) { return new Create(UUID.randomUUID(),kind,null,null,new BigDecimal(amount),"Actual cash transaction"); }
    Entry record(Create input) { return service.create(customer,actor,true,input); }
    @Test void completeCycleIsAppendOnlyAndUsesOriginalRate() {
        record(bottles("GIVE",2)); record(money("COLLECT","100000"));
        assertThat(service.ledger(customer).balance().refundable()).isZero();
        jdbc.update("UPDATE bottle_types SET deposit_unit_amount=99000 WHERE id=?",type);
        record(bottles("RECEIVE",1));
        assertThat(service.ledger(customer).balance().refundable()).isEqualByComparingTo("50000");
        record(money("REFUND","50000"));
        var balance=service.ledger(customer).balance();
        assertThat(balance.bottlesHeld()).isEqualTo(1);
        assertThat(balance.depositHeld()).isEqualByComparingTo("50000");
        assertThat(balance.requiredDeposit()).isEqualByComparingTo("50000");
        assertThat(service.ledger(customer).entries()).hasSize(4);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM payments WHERE recorded_by=?",Long.class,actor)).isZero();
    }
    @Test void protectsBalancesAndSeparatesBottleTypes() {
        record(bottles("GIVE",2)); record(money("COLLECT","100000"));
        assertThatThrownBy(()->record(bottles("RECEIVE",3))).isInstanceOf(ConflictException.class);
        assertThatThrownBy(()->record(money("REFUND","1"))).isInstanceOf(ConflictException.class);
        assertThatThrownBy(()->record(new Create(UUID.randomUUID(),"RECEIVE",Long.MAX_VALUE,1,null,null))).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(()->record(new Create(UUID.randomUUID(),"GIVE",type,1,BigDecimal.ONE,"x"))).isInstanceOf(BadRequestException.class);
        assertThat(service.ledger(customer).entries()).hasSize(2);
    }
    @Test void lossForfeitsOnlyHeldDepositAndRequiresAdminAndReason() {
        record(bottles("GIVE",2)); record(money("COLLECT","10000"));
        assertThatThrownBy(()->service.create(customer,actor,false,bottles("LOSS",1))).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThatThrownBy(()->record(new Create(UUID.randomUUID(),"LOSS",type,1,null,null))).isInstanceOf(BadRequestException.class);
        new TransactionTemplate(manager).executeWithoutResult(tx->{ record(bottles("LOSS",1)); tx.setRollbackOnly(); });
        assertThat(service.ledger(customer).balance().depositHeld()).isEqualByComparingTo("10000");
        assertThat(service.ledger(customer).balance().bottlesHeld()).isEqualTo(2);
        var loss=record(bottles("LOSS",1));
        assertThat(loss.deposit()).isEqualByComparingTo("-10000");
        assertThat(service.ledger(customer).balance().depositHeld()).isZero();
        assertThat(service.ledger(customer).balance().bottlesHeld()).isEqualTo(1);
        jdbc.update("UPDATE deposit_transactions SET created_at='2100-01-01T12:00:00Z' WHERE customer_id=?",customer);
        var parameters=new org.springframework.jdbc.core.namedparam.MapSqlParameterSource()
            .addValue("start",java.sql.Timestamp.from(java.time.Instant.parse("2100-01-01T00:00:00Z")))
            .addValue("end",java.sql.Timestamp.from(java.time.Instant.parse("2100-01-02T00:00:00Z")));
        var report=reports.deposits(parameters);
        assertThat((BigDecimal)report.get("refunded")).isZero();
        assertThat((BigDecimal)report.get("forfeited")).isEqualByComparingTo("10000");
        assertThatThrownBy(()->service.create(customer,actor,false,money("REFUND","1"))).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }
    @Test void retryIsIdempotentAndPayloadCannotChange() {
        var input=bottles("GIVE",2);
        var entry=record(input);
        assertThat(record(input).id()).isEqualTo(entry.id());
        assertThat(service.detail(customer,input.requestId()).bottles()).isEqualTo(2);
        assertThatThrownBy(()->record(new Create(input.requestId(),"GIVE",type,3,null,input.note()))).isInstanceOf(ConflictException.class);
        assertThat(service.ledger(customer).entries()).hasSize(1);
    }
    @Test void concurrentRefundsCannotOverdraw() throws Exception {
        record(money("COLLECT","100000"));
        var barrier=new CyclicBarrier(2);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Boolean> action=()->{ barrier.await(); try { record(money("REFUND","70000")); return true; } catch(ConflictException e) { return false; } };
            var a=pool.submit(action); var b=pool.submit(action);
            assertThat(List.of(a.get(10,TimeUnit.SECONDS),b.get(10,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
        assertThat(service.ledger(customer).balance().depositHeld()).isEqualByComparingTo("30000");
    }
    @Test void rollbackAndArchivedReturnsRemainSupported() {
        new TransactionTemplate(manager).executeWithoutResult(tx->{ record(bottles("GIVE",1)); tx.setRollbackOnly(); });
        assertThat(service.ledger(customer).entries()).isEmpty();
        record(bottles("GIVE",1)); record(money("COLLECT","50000"));
        jdbc.update("UPDATE customers SET active=false WHERE id=?",customer);
        jdbc.update("UPDATE bottle_types SET active=false WHERE id=?",type);
        assertThatThrownBy(()->record(bottles("GIVE",1))).isInstanceOf(ConflictException.class);
        record(bottles("RECEIVE",1)); record(money("REFUND","50000"));
        assertThat(service.ledger(customer).balance().depositHeld()).isZero();
        assertThat(service.balances("Bottle customer",com.aquaflow.shared.api.PageRequestParams.of(0,100)).items().stream().filter(b->b.customerId()==customer).findFirst().orElseThrow().active()).isFalse();
    }
    @Test void restContractValidationAndRoles() throws Exception {
        String path="/api/v1/sales/customers/"+customer+"/bottle-transactions";
        mvc.perform(get("/api/v1/sales/bottle-balances")).andExpect(status().isUnauthorized());
        for(String role:List.of("CUSTOMER","DELIVERY_STAFF")) {
            mvc.perform(get("/api/v1/sales/customers/"+customer+"/bottle-ledger").with(user("x").roles(role))).andExpect(status().isForbidden());
            mvc.perform(post(path).with(user("x").roles(role)).contentType("application/json").content("{}")).andExpect(status().isForbidden());
        }
        var principal=new AuthUserDetails(users.findByIdAndStatus(actor,com.aquaflow.auth.domain.UserStatus.ACTIVE).orElseThrow());
        mvc.perform(post(path).with(user(principal)).contentType("application/json").content("{\"kind\":\"COLLECT\",\"amount\":-1}")).andExpect(status().isBadRequest());
        var requestId=UUID.randomUUID();
        mvc.perform(post(path).with(user(principal)).contentType("application/json").content("{\"requestId\":\""+requestId+"\",\"kind\":\"COLLECT\",\"amount\":1000}"))
            .andExpect(status().isCreated()).andExpect(header().string("Location",path+"/"+requestId)).andExpect(jsonPath("deposit").value(1000));
        mvc.perform(get(path+"/"+requestId).with(user(principal))).andExpect(status().isOk());
        long sales=jdbc.queryForObject("INSERT INTO users(role_id,full_name,email,password_hash) VALUES ((SELECT id FROM roles WHERE code='SALES_STAFF'),'Sales',?,'unused') RETURNING id",Long.class,UUID.randomUUID()+"@bottle.test");
        mvc.perform(post(path).with(user(new AuthUserDetails(users.findByIdAndStatus(sales,com.aquaflow.auth.domain.UserStatus.ACTIVE).orElseThrow()))).contentType("application/json").content("{\"requestId\":\""+UUID.randomUUID()+"\",\"kind\":\"REFUND\",\"amount\":1000,\"note\":\"refund\"}"))
            .andExpect(status().isForbidden());
    }
}
