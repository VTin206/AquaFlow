package com.aquaflow.auth.application;

/** Refresh token thiếu, sai, hết hạn, đã thu hồi, hoặc tài khoản đã khóa/đổi mật khẩu: người dùng phải đăng nhập lại. */
public class InvalidRefreshTokenException extends RuntimeException {

    private final boolean sessionEnded;

    public InvalidRefreshTokenException() {
        this(true);
    }

    /**
     * @param sessionEnded {@code false} khi token vừa được tab khác thay trong vài giây trước: cookie trên trình duyệt
     *                     có thể đã là token mới, nên không được xóa cookie kèm phản hồi lỗi.
     */
    public InvalidRefreshTokenException(boolean sessionEnded) {
        super("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
        this.sessionEnded = sessionEnded;
    }

    public boolean sessionEnded() {
        return sessionEnded;
    }
}
