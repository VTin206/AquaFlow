package com.aquaflow;

import com.aquaflow.auth.application.JwtProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(JwtProperties.class)
public class AquaFlowApplication {

    public static void main(String[] args) {
        SpringApplication.run(AquaFlowApplication.class, args);
    }
}
