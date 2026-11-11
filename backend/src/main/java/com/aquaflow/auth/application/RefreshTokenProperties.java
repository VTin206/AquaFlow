package com.aquaflow.auth.application;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Cấu hình refresh token (app.refresh-token.*). */
@Validated
@ConfigurationProperties(prefix = "app.refresh-token")
public class RefreshTokenProperties {

    /** Phiên tự hết nếu không dùng trong chừng này ngày; mỗi lần làm mới lại tính từ đầu. */
    @Min(1)
    @Max(90)
    private int days = 14;

    /**
     * Cookie chỉ gửi qua HTTPS. Trình duyệt vẫn chấp nhận cookie Secure trên http://localhost,
     * nên chỉ tắt khi chạy thử qua HTTP bằng địa chỉ khác localhost.
     */
    private boolean secureCookie = true;

    public int getDays() {
        return days;
    }

    public void setDays(int days) {
        this.days = days;
    }

    public boolean isSecureCookie() {
        return secureCookie;
    }

    public void setSecureCookie(boolean secureCookie) {
        this.secureCookie = secureCookie;
    }
}
