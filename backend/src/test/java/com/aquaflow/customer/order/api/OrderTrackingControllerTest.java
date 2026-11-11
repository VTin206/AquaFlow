package com.aquaflow.customer.order.api;

import com.aquaflow.auth.application.JwtService;
import com.aquaflow.customer.order.api.dto.PublicOrderResponse;
import com.aquaflow.customer.order.application.OrderTrackingService;
import com.aquaflow.customer.order.domain.FulfillmentType;
import com.aquaflow.customer.order.domain.OrderStatus;
import com.aquaflow.customer.order.domain.PaymentStatus;
import com.aquaflow.shared.api.NotFoundException;
import com.aquaflow.shared.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        value = OrderTrackingController.class,
        properties = "app.jwt.secret=test-test-test-test-test-test-test-test"
)
@Import({SecurityConfig.class, OrderTrackingControllerTest.ClockTestConfig.class})
class OrderTrackingControllerTest {

    private static final String TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";

    @TestConfiguration
    static class ClockTestConfig {
        @Bean
        Clock clock() {
            return Clock.systemUTC();
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrderTrackingService service;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @Test
    void lookupByCodeAndPhoneIsPublic() throws Exception {
        when(service.lookup("af-001070", "0901 234 567")).thenReturn(sample());

        mockMvc.perform(post("/api/v1/order-tracking/lookups")
                        .with(request -> { request.setRemoteAddr("10.0.0.1"); return request; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"orderCode": "af-001070", "phone": "0901 234 567"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderCode").value("AF-001070"))
                .andExpect(jsonPath("$.recipientPhone").value("090****567"))
                .andExpect(jsonPath("$.trackingToken").value(TOKEN))
                .andExpect(jsonPath("$.items[0].productName").value("Bình 20L"))
                .andExpect(jsonPath("$.id").doesNotExist())
                .andExpect(jsonPath("$.note").doesNotExist());
    }

    @Test
    void lookupRequiresCodeAndPhone() throws Exception {
        mockMvc.perform(post("/api/v1/order-tracking/lookups")
                        .with(request -> { request.setRemoteAddr("10.0.0.2"); return request; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"orderCode": "AF-001070", "phone": ""}
                                """))
                .andExpect(status().isBadRequest());
        verify(service, never()).lookup(anyString(), anyString());
    }

    @Test
    void wrongCodeOrPhoneReturns404() throws Exception {
        when(service.lookup("AF-001070", "0999999999"))
                .thenThrow(new NotFoundException(OrderTrackingService.NOT_FOUND));

        mockMvc.perform(post("/api/v1/order-tracking/lookups")
                        .with(request -> { request.setRemoteAddr("10.0.0.3"); return request; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"orderCode": "AF-001070", "phone": "0999999999"}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    void lookupIsRateLimitedPerAddress() throws Exception {
        when(service.lookup(anyString(), anyString())).thenThrow(new NotFoundException(OrderTrackingService.NOT_FOUND));
        for (int i = 0; i < OrderTrackingController.LOOKUP_LIMIT; i++) {
            mockMvc.perform(post("/api/v1/order-tracking/lookups")
                            .with(request -> { request.setRemoteAddr("10.0.0.4"); return request; })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"orderCode\": \"AF-00000" + i + "\", \"phone\": \"0901234567\"}"))
                    .andExpect(status().isNotFound());
        }

        mockMvc.perform(post("/api/v1/order-tracking/lookups")
                        .with(request -> { request.setRemoteAddr("10.0.0.4"); return request; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderCode\": \"AF-000099\", \"phone\": \"0901234567\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "900"));
    }

    @Test
    void trackingLinkIsPublic() throws Exception {
        when(service.byToken(TOKEN)).thenReturn(sample());

        mockMvc.perform(get("/api/v1/order-tracking/" + TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OUT_FOR_DELIVERY"))
                .andExpect(jsonPath("$.due").value(70000));
    }

    @Test
    void malformedTrackingLinkIsNotLookedUp() throws Exception {
        mockMvc.perform(get("/api/v1/order-tracking/short"))
                .andExpect(status().is4xxClientError());
        verify(service, never()).byToken(anyString());
    }

    private PublicOrderResponse sample() {
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-11-10T08:00:00+07:00");
        return new PublicOrderResponse(
                "AF-001070", OrderStatus.OUT_FOR_DELIVERY, FulfillmentType.DELIVERY, PaymentStatus.UNPAID, false,
                "Nguyen Van An", "090****567", "123 Nguyen Trai", "Phường Chợ Quán", null,
                new BigDecimal("60000"), BigDecimal.ZERO, new BigDecimal("10000"), new BigDecimal("70000"),
                BigDecimal.ZERO, new BigDecimal("70000"), createdAt, createdAt, null, null, TOKEN,
                List.of(new PublicOrderResponse.Item(1L, "Bình 20L", "Bình", 1,
                        new BigDecimal("60000"), new BigDecimal("60000"))));
    }
}
