-- Tìm kiếm phía server cho danh sách đơn và khách có phân trang.
-- unaccent là extension "trusted" từ PostgreSQL 13: chủ database tạo được, không cần superuser.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Giống normalizeSearch ở frontend: bỏ dấu tiếng Việt (kể cả đ/Đ), chữ thường, gộp khoảng trắng.
-- Gọi unaccent với từ điển chỉ định rõ để hàm được khai báo IMMUTABLE.
CREATE FUNCTION af_search_text(value TEXT) RETURNS TEXT
    LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$
SELECT btrim(regexp_replace(lower(public.unaccent('public.unaccent'::regdictionary, coalesce(value, ''))), '\s+', ' ', 'g'))
$$;

-- Giống phoneDigits ở frontend: chỉ giữ chữ số, +84/84 đầu số đổi về 0.
CREATE FUNCTION af_phone_digits(value TEXT) RETURNS TEXT
    LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$
SELECT regexp_replace(regexp_replace(coalesce(value, ''), '\D', '', 'g'), '^84(\d{9,10})$', '0\1')
$$;

-- Trang Đơn hàng sắp xếp mới nhất trước và lật trang theo (created_at, id).
CREATE INDEX IF NOT EXISTS idx_orders_created_at_id ON orders (created_at DESC, id DESC);
