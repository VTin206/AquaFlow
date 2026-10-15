package com.aquaflow.shared.health;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.flywaydb.autoconfigure.FlywayAutoConfiguration"
})
class HealthControllerTest {

    @Test
    void applicationContextLoads() {
        assertThat(true).isTrue();
    }
}
