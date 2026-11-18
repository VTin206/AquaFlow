-- Tìm kiếm phía server cho danh sách đơn và khách có phân trang.
-- unaccent là extension "trusted" từ PostgreSQL 13: chủ database tạo được, không cần superuser.
-- Đã cài sẵn thì giữ nguyên chỗ cài (Supabase đặt extension trong schema "extensions"); chưa có thì cài vào
-- schema đầu tiên của search_path (schema của ứng dụng khi chạy với currentSchema).
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Giống normalizeSearch ở frontend: bỏ dấu tiếng Việt (kể cả đ/Đ), chữ thường, gộp khoảng trắng.
-- Gọi unaccent với từ điển chỉ định rõ để hàm được khai báo IMMUTABLE. Schema của extension lấy lúc migrate
-- (không viết cứng "public") để chạy được cả trên PostgreSQL thường lẫn Supabase.
DO $migration$
DECLARE
    extension_schema TEXT := (
        SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'unaccent');
BEGIN
    EXECUTE format($sql$
        CREATE FUNCTION af_search_text(value TEXT) RETURNS TEXT
            LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
        $body$
        SELECT btrim(regexp_replace(lower(%1$I.unaccent(%2$L::regdictionary, coalesce(value, ''))), '\s+', ' ', 'g'))
        $body$
        $sql$, extension_schema, format('%I.unaccent', extension_schema));
END
$migration$;

-- Giống phoneDigits ở frontend: chỉ giữ chữ số, +84/84 đầu số đổi về 0.
CREATE FUNCTION af_phone_digits(value TEXT) RETURNS TEXT
    LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$
SELECT regexp_replace(regexp_replace(coalesce(value, ''), '\D', '', 'g'), '^84(\d{9,10})$', '0\1')
$$;

-- Trang Đơn hàng sắp xếp mới nhất trước và lật trang theo (created_at, id).
CREATE INDEX IF NOT EXISTS idx_orders_created_at_id ON orders (created_at DESC, id DESC);
