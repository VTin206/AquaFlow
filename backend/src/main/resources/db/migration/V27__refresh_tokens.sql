-- Refresh token cho phiên đăng nhập dài: chỉ lưu SHA-256 của token, token thật nằm trong cookie HttpOnly.
-- Mỗi lần làm mới, token cũ bị thu hồi và thay bằng token mới cùng family_id (xoay vòng).
-- Token đã thu hồi mà bị dùng lại (bị đánh cắp) thì thu hồi cả family.
-- credentials_version chụp lúc cấp: đổi/đặt lại mật khẩu hoặc khóa tài khoản làm token cũ mất hiệu lực.
CREATE TABLE refresh_tokens (
    id                  BIGSERIAL PRIMARY KEY,
    token_hash          VARCHAR(64) NOT NULL UNIQUE,
    family_id           UUID        NOT NULL,
    user_id             BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    credentials_version INTEGER     NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    revoked_at          TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);
