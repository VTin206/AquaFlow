package com.aquaflow.auth.application;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Gửi mã xác nhận đăng ký. Chỉ bật khi đặt {@code REGISTRATION_VERIFY_EMAIL=true} và đã cấu hình SMTP;
 * khi tắt, khách đăng ký không cần mã như trước (máy chưa cấu hình mail vẫn chạy được).
 */
@Service
public class RegistrationMail {
    private final ObjectProvider<JavaMailSender> sender;
    private final boolean enabled;
    private final String from;

    public RegistrationMail(ObjectProvider<JavaMailSender> sender,
            @Value("${app.registration.verify-email:false}") boolean enabled,
            @Value("${app.registration.from:}") String from,
            @Value("${spring.mail.host:}") String host) {
        this.sender = sender; this.enabled = enabled; this.from = from;
        if (enabled && (from.isBlank() || host.isBlank()))
            throw new IllegalArgumentException("REGISTRATION_VERIFY_EMAIL=true needs SMTP_HOST and SMTP_FROM");
    }

    public boolean enabled() { return enabled; }

    public void send(String recipient, String code, long validMinutes) {
        var mail = new SimpleMailMessage();
        mail.setFrom(from);
        mail.setTo(recipient);
        mail.setSubject("AquaFlow - Mã xác nhận đăng ký: " + code);
        mail.setText("Mã xác nhận đăng ký tài khoản AquaFlow của bạn là:\n\n    " + code
                + "\n\nNhập mã này vào cửa sổ xác nhận trên trang đăng ký. Mã có hiệu lực " + validMinutes
                + " phút và chỉ dùng một lần."
                + "\nNếu bạn không đăng ký tài khoản, hãy bỏ qua email này.");
        sender.getObject().send(mail);
    }
}
