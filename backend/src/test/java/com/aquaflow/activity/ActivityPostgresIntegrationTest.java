package com.aquaflow.activity;

import com.aquaflow.auth.domain.User;
import com.aquaflow.auth.security.AuthUserDetails;
import com.aquaflow.inventory.application.SupplierService;
import com.aquaflow.inventory.api.dto.SupplierRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import java.util.List;
import java.util.UUID;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@Transactional
@EnabledIfEnvironmentVariable(named="DB_URL",matches=".+")
class ActivityPostgresIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ActivityRepository repository;
    @Autowired SupplierService suppliers;
    @Autowired PlatformTransactionManager manager;
    static final String BASE="/api/v1/admin/activity-logs";
    long actor;
    @BeforeEach void setup() {
        jdbc.update("INSERT INTO roles(code,name) VALUES ('ADMIN','Owner') ON CONFLICT(code) DO NOTHING");
        actor=jdbc.queryForObject("INSERT INTO users(role_id,full_name,email,password_hash) VALUES ((SELECT id FROM roles WHERE code='ADMIN'),'Audit tester',?,'unused') RETURNING id",Long.class,UUID.randomUUID()+"@audit.test");
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    void authenticate() {
        User current=mock(User.class); when(current.getId()).thenReturn(actor);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
            new AuthUserDetails(current),null,List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }
    @Test void successfulCommandsRecordActorAndEntityWithoutRequestData() {
        authenticate();
        var supplier=suppliers.create(new SupplierRequest("Audit supplier","0901234567","Private address"));
        var entries=repository.list("SUPPLIERS",actor,null,null,null,0,20);
        assertThat(entries.totalElements()).isEqualTo(1);
        var entry=entries.content().getFirst();
        assertThat(entry.entityId()).isEqualTo(supplier.id());
        assertThat(entry.actorId()).isEqualTo(actor);
        assertThat(entry.action()).isEqualTo("create");
        assertThat(entry.reason()).doesNotContain("Private address","0901234567");
        suppliers.findById(supplier.id());
        assertThat(repository.list(null,actor,null,null,null,0,20).totalElements()).isEqualTo(1);
    }
    @Test void failedCommandDoesNotRecordSuccessfulActivity() {
        authenticate();
        assertThatThrownBy(()->suppliers.update(Long.MAX_VALUE,new SupplierRequest("Missing",null,null)))
            .isInstanceOf(com.aquaflow.shared.api.NotFoundException.class);
        assertThat(repository.list(null,actor,null,null,null,0,20).totalElements()).isZero();
    }
    @Test void businessChangeAndAuditRollBackTogether() {
        // REQUIRES_NEW suspends the fixture transaction. Anonymous system actor needs no fixture FK.
        var tx=new TransactionTemplate(manager);
        tx.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        long[] supplierId={0};
        assertThatThrownBy(()->tx.execute(status->{
            supplierId[0]=suppliers.create(new SupplierRequest("Rollback supplier",null,null)).id();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE entity_type='SUPPLIER' AND entity_id=?",Long.class,supplierId[0])).isEqualTo(1);
            throw new IllegalStateException("Rollback requested");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM suppliers WHERE id=?",Long.class,supplierId[0])).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE entity_type='SUPPLIER' AND entity_id=?",Long.class,supplierId[0])).isZero();
    }
    @Test void resourcesEnforceAdminReadOnlyAndValidation() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
        for(String role:List.of("SALES_STAFF","DELIVERY_STAFF","CUSTOMER"))
            mvc.perform(get(BASE).with(user("staff").roles(role))).andExpect(status().isForbidden());
        mvc.perform(get(BASE).with(user("owner").roles("ADMIN"))).andExpect(status().isOk());
        mvc.perform(get(BASE+"/actors").with(user("owner").roles("ADMIN"))).andExpect(status().isOk());
        mvc.perform(get(BASE+"/999999999").with(user("owner").roles("ADMIN"))).andExpect(status().isNotFound());
        for(String query:List.of("size=101","page=-1","area=FAKE","actorId=0","from=2026-01-02T00:00:00Z&to=2026-01-01T00:00:00Z"))
            mvc.perform(get(BASE+"?"+query).with(user("owner").roles("ADMIN"))).andExpect(status().isBadRequest());
        mvc.perform(post(BASE).with(user("owner").roles("ADMIN")).contentType("application/json").content("{}"))
            .andExpect(status().isMethodNotAllowed());
        mvc.perform(delete(BASE+"/1").with(user("owner").roles("ADMIN"))).andExpect(status().isMethodNotAllowed());
    }
    @Test void filtersAndStablePaginationKeepExistingAuditHistory() throws Exception {
        Instant start=Instant.parse("2026-01-01T00:00:00Z");
        for(int i=0;i<3;i++) jdbc.update("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,reason,created_at,before_json) VALUES (?,'UPDATE','CUSTOMER',42,'literal %_ token',?,'{\"phone\":\"private\"}')",actor,java.sql.Timestamp.from(start.plusSeconds(i)));
        var first=repository.list("CUSTOMERS",actor,start,start.plusSeconds(2),"%_",0,1);
        var second=repository.list("CUSTOMERS",actor,start,start.plusSeconds(2),"%_",1,1);
        assertThat(first.totalElements()).isEqualTo(2);
        assertThat(first.content().getFirst().id()).isGreaterThan(second.content().getFirst().id());
        assertThat(repository.list(null,actor,null,null,"' OR 1=1 --",0,20).totalElements()).isZero();
        mvc.perform(get(BASE+"/"+first.content().getFirst().id()).with(user("owner").roles("ADMIN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.action").value("UPDATE"))
            .andExpect(jsonPath("$.beforeJson").doesNotExist());
        assertThat(repository.actors()).anyMatch(person->person.id()==actor);
    }
}
