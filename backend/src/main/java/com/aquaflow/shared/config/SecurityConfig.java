package com.aquaflow.shared.config;

import com.aquaflow.auth.security.JwtAuthenticationFilter;
import com.aquaflow.auth.application.JwtService;
import com.aquaflow.shared.api.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    JwtAuthenticationFilter jwtAuthenticationFilter(
            JwtService jwtService,
            UserDetailsService userDetailsService) {
        return new JwtAuthenticationFilter(jwtService, userDetailsService);
    }

    @Bean
    FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration(JwtAuthenticationFilter filter) {
        FilterRegistrationBean<JwtAuthenticationFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthenticationFilter jwtAuthenticationFilter,
            AuthenticationEntryPoint authenticationEntryPoint,
            AccessDeniedHandler accessDeniedHandler) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/health", "/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/login", "/api/v1/auth/register").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/password-reset-requests", "/api/v1/auth/password-resets").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/store-profile").permitAll()
                        // Public catalog is intentionally limited to the existing collection/detail endpoints.
                        // Do not use /** here: future administrative sub-resources must not become public by accident.
                        .requestMatchers(HttpMethod.GET,
                                "/api/v1/products", "/api/v1/products/*",
                                "/api/v1/bottle-types", "/api/v1/bottle-types/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/suppliers/**").hasAnyRole("ADMIN", "SALES_STAFF")
                        // NhÃ¢n viÃªn láº­p/sá»­a phiáº¿u nháº­p/xÃ¡c nháº­n (cá»™ng tá»“n)/há»§y phiáº¿u
                        .requestMatchers("/api/v1/purchase-receipts/**").hasAnyRole("ADMIN", "SALES_STAFF")
                        .requestMatchers("/api/v1/inventory/**").hasAnyRole("ADMIN", "SALES_STAFF")
                        .requestMatchers("/api/v1/products/**", "/api/v1/bottle-types/**", "/api/v1/suppliers/**").hasAnyRole("ADMIN", "SALES_STAFF")
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/store-settings").hasAnyRole("ADMIN", "SALES_STAFF", "DELIVERY_STAFF")
                        .requestMatchers("/api/v1/store-settings/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/sales/**").hasAnyRole("ADMIN", "SALES_STAFF")
                        .requestMatchers(HttpMethod.POST, "/api/v1/delivery-quotes").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/customer/orders/guest").permitAll()

                        // Delivery option lists expose store-wide data and are restricted to store staff.
                        .requestMatchers(HttpMethod.GET,
                                "/api/v1/delivery/drivers",
                                "/api/v1/delivery/available-orders")
                                .hasAnyRole("ADMIN", "SALES_STAFF")

                        // Read endpoints are available to store staff and drivers. DeliveryService applies
                        // trip/driver ownership checks before returning data to DELIVERY_STAFF.
                        .requestMatchers(HttpMethod.GET,
                                "/api/v1/delivery/trips",
                                "/api/v1/delivery/trips/*",
                                "/api/v1/delivery/trips/*/orders/*",
                                "/api/v1/delivery/trips/*/orders/*/attempts",
                                "/api/v1/delivery/trips/*/orders/*/attempts/*",
                                "/api/v1/delivery/trips/*/settlement",
                                "/api/v1/delivery/trips/*/collections",
                                "/api/v1/delivery/assignments/*/attempts",
                                "/api/v1/delivery/assignments/*/attempts/*")
                                .hasAnyRole("ADMIN", "SALES_STAFF", "DELIVERY_STAFF")

                        // Dispatch, trip/assignment management and return inspection are store-staff operations.
                        // Redelivery is performed by POST /trips/{id}/orders with redelivery=true;
                        // there is no /attempts/{id}/redelivery endpoint.
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/delivery/assignments/*/dispatch",
                                "/api/v1/delivery/attempts/*/return-inspection",
                                "/api/v1/delivery/trips",
                                "/api/v1/delivery/trips/*/orders",
                                "/api/v1/delivery/trips/*/dispatch",
                                "/api/v1/delivery/trips/*/orders/*/dispatch")
                                .hasAnyRole("ADMIN", "SALES_STAFF")

                        // Drivers may record attempts and collections only for their own assigned trips;
                        // the controller passes the actor identity to DeliveryService for ownership checks.
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/delivery/assignments/*/attempts",
                                "/api/v1/delivery/trips/*/orders/*/attempts",
                                "/api/v1/delivery/trips/*/orders/*/collections")
                                .hasAnyRole("ADMIN", "SALES_STAFF", "DELIVERY_STAFF")

                        .requestMatchers(HttpMethod.PUT,
                                "/api/v1/delivery/trips/*/driver",
                                "/api/v1/delivery/trips/*/settlement")
                                .hasAnyRole("ADMIN", "SALES_STAFF")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/delivery/trips/*/departure")
                                .hasAnyRole("ADMIN", "SALES_STAFF", "DELIVERY_STAFF")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/delivery/trips/*")
                                .hasAnyRole("ADMIN", "SALES_STAFF")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/delivery/trips/*/orders/*")
                                .hasAnyRole("ADMIN", "SALES_STAFF")

                        // Fail closed for future/unlisted Delivery routes instead of granting access by default.
                        .requestMatchers(HttpMethod.GET, "/api/v1/delivery/assignments/*/bottles").hasAnyRole("ADMIN", "SALES_STAFF", "DELIVERY_STAFF")
                        .requestMatchers(HttpMethod.GET, "/api/v1/delivery/assignments/*/bottle-returns/*").hasAnyRole("ADMIN", "SALES_STAFF", "DELIVERY_STAFF")
                        .requestMatchers(HttpMethod.POST, "/api/v1/delivery/assignments/*/bottle-returns").hasAnyRole("ADMIN", "SALES_STAFF", "DELIVERY_STAFF")
                        .requestMatchers("/api/v1/delivery/**").denyAll()
                        .requestMatchers("/api/v1/customer/account/**").hasRole("CUSTOMER")
                        .requestMatchers("/api/v1/customer/**").hasAnyRole("ADMIN", "CUSTOMER")
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    AuthenticationEntryPoint authenticationEntryPoint(ObjectMapper objectMapper) {
        return (request, response, exception) -> writeError(
                objectMapper,
                request.getRequestURI(),
                response,
                HttpServletResponse.SC_UNAUTHORIZED,
                "Unauthorized",
                "Authentication is required to access this resource");
    }

    @Bean
    AccessDeniedHandler accessDeniedHandler(ObjectMapper objectMapper) {
        return (request, response, exception) -> writeError(
                objectMapper,
                request.getRequestURI(),
                response,
                HttpServletResponse.SC_FORBIDDEN,
                "Forbidden",
                "You do not have permission to access this resource");
    }

    private void writeError(
            ObjectMapper objectMapper,
            String path,
            HttpServletResponse response,
            int status,
            String error,
            String message) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(objectMapper.writeValueAsString(new ApiError(
                java.time.Instant.now(), status, error, message, path)));
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:5173", "http://127.0.0.1:5173"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
