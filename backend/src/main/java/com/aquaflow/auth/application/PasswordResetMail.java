package com.aquaflow.auth.application;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import java.net.URI;

@Service
public class PasswordResetMail {
    private final ObjectProvider<JavaMailSender> sender;
    private final boolean enabled;
    private final String from;
    private final String baseUrl;
    public PasswordResetMail(ObjectProvider<JavaMailSender> sender,
            @Value("${app.password-reset.enabled:false}") boolean enabled,
            @Value("${app.password-reset.from:}") String from,
            @Value("${app.password-reset.frontend-url:}") String baseUrl) {
        this.sender = sender; this.enabled = enabled; this.from = from; this.baseUrl = baseUrl.replaceAll("/+$", "");
        if (enabled) {
            URI uri = URI.create(this.baseUrl);
            boolean local = "localhost".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost());
            if (uri.getHost() == null || uri.getQuery() != null || uri.getFragment() != null || uri.getUserInfo() != null
                    || !("https".equals(uri.getScheme()) || (local && "http".equals(uri.getScheme())))
                    || from.isBlank()) throw new IllegalArgumentException("Invalid password reset mail configuration");
        }
    }
    public boolean available() { return enabled && sender.getIfAvailable() != null; }
    public void send(String recipient, String token) {
        var mail = new SimpleMailMessage();
        mail.setFrom(from);
        mail.setTo(recipient);
        mail.setSubject("AquaFlow - Đặt lại mật khẩu");
        mail.setText("Bạn đã yêu cầu đặt lại mật khẩu AquaFlow.\n\n"
                + baseUrl + "/reset-password#token=" + token
                + "\n\nLiên kết có hiệu lực 15 phút và chỉ dùng một lần."
                + "\nNếu không phải bạn yêu cầu, hãy bỏ qua email này. Mật khẩu của bạn chưa thay đổi.");
        sender.getObject().send(mail);
    }
}
