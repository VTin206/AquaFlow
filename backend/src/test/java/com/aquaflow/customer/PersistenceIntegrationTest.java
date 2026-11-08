package com.aquaflow.customer;

import com.aquaflow.customer.domain.Customer;
import com.aquaflow.customer.domain.CustomerAddress;
import com.aquaflow.customer.repository.CustomerAddressRepository;
import com.aquaflow.customer.repository.CustomerRepository;
import com.aquaflow.inventory.domain.Product;
import com.aquaflow.inventory.repository.ProductRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Runs against the PostgreSQL service supplied by CI, including Flyway and JPA validation. */
@SpringBootTest(properties = "app.jwt.secret=test-test-test-test-test-test-test-test")
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
@Transactional
class PersistenceIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private CustomerRepository customers;

    @Autowired
    private CustomerAddressRepository addresses;

    @Autowired
    private ProductRepository products;



    @Test
    void migrationsAndActivePhoneConstraintWorkOnPostgres() {
        Integer applied = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE success = TRUE", Integer.class);
        assertThat(applied).isGreaterThanOrEqualTo(3);

        customers.saveAndFlush(new Customer("Customer One", "0901234567"));
        assertThatThrownBy(() -> customers.saveAndFlush(new Customer("Customer Two", "0901234567")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void onlyOneDefaultAddressPerCustomerIsAllowed() {
        Customer customer = customers.saveAndFlush(new Customer("Address Owner", "0901234568"));
        CustomerAddress first = new CustomerAddress(customer, "Owner", "0901234568", "Address 1", null);
        first.setDefault(true);
        addresses.saveAndFlush(first);

        CustomerAddress second = new CustomerAddress(customer, "Owner", "0901234568", "Address 2", null);
        second.setDefault(true);
        assertThatThrownBy(() -> addresses.saveAndFlush(second))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void duplicateProductSkuIsRejectedByDatabase() {
        products.saveAndFlush(new Product("TEST-SKU-1", "Water", null, "Bottle", null, null, BigDecimal.TEN));

        assertThatThrownBy(() -> products.saveAndFlush(
                new Product("TEST-SKU-1", "Water 2", null, "Bottle", null, null, BigDecimal.TEN)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
