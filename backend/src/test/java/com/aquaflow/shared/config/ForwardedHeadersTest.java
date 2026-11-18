package com.aquaflow.shared.config;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.http.HttpMessageConvertersAutoConfiguration;
import org.springframework.boot.autoconfigure.web.embedded.EmbeddedWebServerFactoryCustomizerAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.DispatcherServletAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.ServletWebServerFactoryAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Backend chạy sau nginx; giới hạn đăng nhập/tra cứu đơn khóa theo {@code getRemoteAddr()}.
 * Test chạy Tomcat thật với cấu hình trong application.yml để chắc rằng IP lấy ra là của khách,
 * không phải IP của proxy, và khách không tự giả IP bằng cách gửi sẵn X-Forwarded-For.
 */
@SpringBootTest(
        classes = ForwardedHeadersTest.WebOnly.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ForwardedHeadersTest {

    @SpringBootConfiguration
    @ImportAutoConfiguration({
            ServletWebServerFactoryAutoConfiguration.class,
            EmbeddedWebServerFactoryCustomizerAutoConfiguration.class,
            DispatcherServletAutoConfiguration.class,
            WebMvcAutoConfiguration.class,
            HttpMessageConvertersAutoConfiguration.class})
    static class WebOnly {
        @RestController
        static class RemoteAddressEcho {
            @GetMapping("/remote-address")
            String remoteAddress(HttpServletRequest request) {
                return request.getRemoteAddr();
            }
        }
    }

    @LocalServerPort
    private int port;

    private final HttpClient client = HttpClient.newHttpClient();

    @Test
    void clientAddressComesFromProxyHeader() throws Exception {
        // Kết nối tới từ 127.0.0.1 (giống nginx trong mạng nội bộ), nginx ghi IP khách vào header.
        assertThat(remoteAddress("203.0.113.7")).isEqualTo("203.0.113.7");
    }

    @Test
    void spoofedHeaderFromClientIsIgnored() throws Exception {
        // nginx dùng $proxy_add_x_forwarded_for: giá trị khách tự gửi nằm bên trái, IP thật nằm cuối.
        assertThat(remoteAddress("198.51.100.1, 203.0.113.7")).isEqualTo("203.0.113.7");
    }

    @Test
    void withoutHeaderTheConnectionAddressIsUsed() throws Exception {
        assertThat(remoteAddress(null)).isEqualTo("127.0.0.1");
    }

    private String remoteAddress(String forwardedFor) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/remote-address"));
        if (forwardedFor != null) request.header("X-Forwarded-For", forwardedFor);
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString()).body();
    }
}
