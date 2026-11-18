package com.aquaflow.customer.order;

import com.aquaflow.customer.order.api.dto.GuestOrderCreateRequest;
import com.aquaflow.customer.order.api.dto.OrderItemRequest;
import com.aquaflow.customer.order.application.OrderService;
import com.aquaflow.customer.order.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class ShortOrderCodePostgresIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired OrderService service;
    @Autowired OrderRepository orders;

    @Test @Transactional void newOrdersHaveShortCodesAndOldCodesRemainSearchable() {
        long product=jdbc.queryForObject("INSERT INTO products(sku,name,unit,sale_price) VALUES (?,'Code test','Bình',50000) RETURNING id",Long.class,UUID.randomUUID().toString());
        var request=new GuestOrderCreateRequest("Test","0901234567","Address",null,null,List.of(new OrderItemRequest(product,1)),null);
        var first=service.createForGuest(request);
        var second=service.createForGuest(request);
        assertThat(first.orderCode()).matches("AF-[0-9]{6,}").isNotEqualTo(second.orderCode());
        assertThat(orders.findByOrderCode(first.orderCode())).isPresent();
        String legacy="AF-"+UUID.randomUUID().toString().replace("-", "").substring(0,20).toUpperCase();
        jdbc.update("UPDATE orders SET order_code=? WHERE id=?",legacy,first.id());
        assertThat(orders.findByOrderCode(legacy)).isPresent();
    }
    @Test void parallelAllocationsAreUnique() throws Exception {
        try(var executor=Executors.newFixedThreadPool(8)) {
            var tasks=java.util.stream.IntStream.range(0,100)
                .mapToObj(i -> (java.util.concurrent.Callable<Long>) orders::nextOrderCodeNumber).toList();
            var values=new java.util.HashSet<Long>();
            for(var result:executor.invokeAll(tasks)) values.add(result.get());
            assertThat(values).hasSize(100).allMatch(value -> value>0);
        }
    }
}
