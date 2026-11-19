-- Mã 6 số gửi qua email khi khách tự đăng ký tài khoản. Mỗi email chỉ giữ mã mới nhất;
-- dòng bị xóa khi tạo tài khoản thành công. Chỉ lưu mã đã băm (BCrypt), không lưu mã gốc.
CREATE TABLE registration_verifications (
    email VARCHAR(150) PRIMARY KEY,
    code_hash VARCHAR(100) NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT chk_registration_verifications_email_lower CHECK (email = lower(email)),
    CONSTRAINT chk_registration_verifications_attempts CHECK (attempts >= 0),
    CONSTRAINT chk_registration_verifications_expiry CHECK (expires_at > sent_at)
);
