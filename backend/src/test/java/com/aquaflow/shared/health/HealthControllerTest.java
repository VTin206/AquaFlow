package com.aquaflow.shared.health;

import com.aquaflow.auth.repository.UserRepository;
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
    private UserRepository userRepository;

    @Test
    void applicationContextLoads() {
        assertThat(true).isTrue();
    }
}
