package com.aquaflow.customer.order;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.assertThat;
import java.util.UUID;

@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@AutoConfigureMockMvc
@Transactional
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class DeliveryQuotePostgresIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager entityManager;
    @Autowired com.aquaflow.customer.order.application.OrderService orders;

    @Test void customerOrdersUseTheQuoteAndThreeUnitsWaiveOnlyBaseFee() {
        long id = product();
        long customer = jdbc.queryForObject("INSERT INTO customers(full_name) VALUES ('Quote customer') RETURNING id", Long.class);
        var request = new com.aquaflow.customer.order.api.dto.OrderCreateRequest(
                null, com.aquaflow.customer.order.domain.OrderChannel.WEB,
                com.aquaflow.customer.order.domain.FulfillmentType.DELIVERY,
                "Customer", "0901234567", "Address", null, null,
                java.util.List.of(new com.aquaflow.customer.order.api.dto.OrderItemRequest(id, 3)),
                null, 4, new java.math.BigDecimal("186000"));
        var order = orders.createForCustomer(request, customer, null);
        assertThat(order.customerId()).isEqualTo(customer);
        assertThat(order.deliveryFee()).isEqualByComparingTo("36000");
        assertThat(order.total()).isEqualByComparingTo("186000");
    }

    private long product() {
        return jdbc.queryForObject("INSERT INTO products(sku,name,unit,sale_price) VALUES (?,'Quote water','Bình',50000) RETURNING id", Long.class, "QUOTE-" + UUID.randomUUID());
    }
    @Test void publicQuoteAndGuestOrderUseSamePriceAndPersistFee() throws Exception {
        long id = product();
        String items = "\"items\":[{\"productId\":" + id + ",\"quantity\":2}],\"stairFloor\":2";
        mvc.perform(post("/api/v1/delivery-quotes").contentType("application/json").content("{"+items+"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("baseFee").value(15000))
                .andExpect(jsonPath("stairsFee").value(8000)).andExpect(jsonPath("total").value(123000));
        mvc.perform(post("/api/v1/customer/orders/guest").contentType("application/json")
                .content("{"+items+",\"recipientName\":\"Test\",\"recipientPhone\":\"0901234567\",\"deliveryAddress\":\"Test\",\"expectedTotal\":123000}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("deliveryFee").value(23000))
                .andExpect(jsonPath("total").value(123000)).andExpect(jsonPath("note").value("Số tầng đi thang bộ: 2"));
        assertThat(jdbc.queryForObject("SELECT delivery_fee FROM orders WHERE id=(SELECT order_id FROM order_items WHERE product_id=?)", java.math.BigDecimal.class,id)).isEqualByComparingTo("23000");
    }
    @Test void rejectsStaleTotalsAndInvalidFloors() throws Exception {
        long id = product();
        mvc.perform(post("/api/v1/customer/orders/guest").contentType("application/json")
                .content("{\"items\":[{\"productId\":"+id+",\"quantity\":1}],\"recipientName\":\"Test\",\"recipientPhone\":\"0901234567\",\"deliveryAddress\":\"Test\",\"expectedTotal\":1}"))
                .andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM order_items WHERE product_id=?",Integer.class,id)).isZero();
        mvc.perform(post("/api/v1/delivery-quotes").contentType("application/json")
                .content("{\"items\":[{\"productId\":"+id+",\"quantity\":1}],\"stairFloor\":-1}"))
                .andExpect(status().isBadRequest());
        jdbc.update("UPDATE products SET active=false WHERE id=?",id);
        entityManager.clear(); // JDBC fixture update must also invalidate the test transaction's JPA cache.
        mvc.perform(post("/api/v1/delivery-quotes").contentType("application/json")
                .content("{\"items\":[{\"productId\":"+id+",\"quantity\":1}]}"))
                .andExpect(status().isNotFound());
    }
}
