package com.aquaflow.shared.health;

import com.aquaflow.customer.order.repository.OrderItemRepository;
import com.aquaflow.customer.order.repository.OrderRepository;
import com.aquaflow.customer.repository.CustomerAddressRepository;
import com.aquaflow.customer.application.CustomerAuditService;
import com.aquaflow.customer.repository.CustomerRepository;
import com.aquaflow.auth.repository.UserRepository;
import com.aquaflow.inventory.repository.BottleTypeRepository;
import com.aquaflow.inventory.repository.ProductRepository;
import com.aquaflow.inventory.repository.SupplierRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "app.jwt.secret=test-test-test-test-test-test-test-test",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.flywaydb.autoconfigure.FlywayAutoConfiguration"
})
class HealthControllerTest {

    @MockBean
    private com.aquaflow.inventory.application.PurchaseReceiptService purchaseReceiptService;

    @MockBean
    private com.aquaflow.inventory.application.StockService stockService;

    @MockBean
    private com.aquaflow.inventory.application.StockReservationService stockReservationService;

    @MockBean
    private UserRepository userRepository;

    // Test này tắt JPA nên phải giả lập các repository của module inventory
    @MockBean
    private ProductRepository productRepository;

    @MockBean
    private SupplierRepository supplierRepository;

    @MockBean
    private BottleTypeRepository bottleTypeRepository;

    @MockBean
    private CustomerRepository customerRepository;

    @MockBean
    private CustomerAddressRepository customerAddressRepository;

    @MockBean
    private CustomerAuditService customerAuditService;

    @MockBean
    private OrderRepository orderRepository;

    @MockBean
    private OrderItemRepository orderItemRepository;

    @Test
    void applicationContextLoads() {
        assertThat(true).isTrue();
    }
}
