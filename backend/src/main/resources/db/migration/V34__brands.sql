-- Thương hiệu quản lý riêng: tên chuẩn, các tên gọi khác (chữ thường) và logo.
-- products.brand (chữ gõ tay) giữ nguyên để tương thích; products.brand_id nối tới thương hiệu khớp tên hoặc tên gọi khác.
CREATE TABLE brands (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL CHECK (btrim(name) <> ''),
    aliases TEXT[] NOT NULL DEFAULT '{}',
    logo VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_brands_name ON brands (lower(name));

ALTER TABLE products ADD COLUMN brand_id BIGINT REFERENCES brands(id);
CREATE INDEX idx_products_brand ON products(brand_id);

-- Danh sách chuẩn đang dùng ở giao diện (catalogGroups.ts).
INSERT INTO brands(name, aliases, logo) VALUES
    ('LaVie', ARRAY['lavie','viva'], '/images/brands/lavie.png'),
    ('Vĩnh Hảo', ARRAY['vĩnh hảo','vihawa'], '/images/brands/vinh-hao.png'),
    ('Aquafina', ARRAY['aquafina'], '/images/brands/aquafina.png'),
    ('ion Life', ARRAY['ion life'], '/images/brands/ion-life.png'),
    ('Satori', ARRAY['satori'], '/images/brands/satori.png'),
    ('Bidrico', ARRAY['bidrico'], '/images/brands/bidrico.png'),
    ('Rosée', ARRAY['rosée','rosee'], '/images/brands/rosee.png'),
    ('TH true Water', ARRAY['th true water'], '/images/brands/th-true-water.png'),
    ('Dasani', ARRAY['dasani'], NULL),
    ('Pocari Sweat', ARRAY['pocari sweat'], NULL),
    ('Revive (Pepsi)', ARRAY['revive','pepsi'], '/images/brands/pepsi.png'),
    ('Lemont', ARRAY['lemont'], NULL),
    ('Sapuwa', ARRAY['sapuwa'], NULL),
    ('Wami', ARRAY['wami'], NULL),
    ('333', ARRAY['333'], NULL),
    ('Đảnh Thạch', ARRAY['đảnh thạch'], NULL),
    ('Thạch Bích', ARRAY['thạch bích'], NULL);

-- Thương hiệu gõ tay trên sản phẩm mà chưa khớp danh sách chuẩn: tạo thành thương hiệu riêng.
INSERT INTO brands(name, aliases)
SELECT DISTINCT ON (lower(btrim(p.brand))) btrim(p.brand), ARRAY[lower(btrim(p.brand))]
FROM products p
WHERE p.brand IS NOT NULL AND btrim(p.brand) <> '' AND btrim(p.brand) <> 'Chưa có thương hiệu'
  AND NOT EXISTS (SELECT 1 FROM brands b
                  WHERE lower(b.name) = lower(btrim(p.brand)) OR lower(btrim(p.brand)) = ANY(b.aliases))
ORDER BY lower(btrim(p.brand)), btrim(p.brand);

UPDATE products p SET brand_id = b.id
FROM brands b
WHERE p.brand IS NOT NULL
  AND (lower(b.name) = lower(btrim(p.brand)) OR lower(btrim(p.brand)) = ANY(b.aliases));
