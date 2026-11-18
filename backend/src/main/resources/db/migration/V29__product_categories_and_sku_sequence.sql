-- Loại sản phẩm do cửa hàng tự quản lý (thêm, đổi tên, ngừng dùng, xóa khi chưa có sản phẩm nào),
-- thay cho danh sách cố định products.water_type.
CREATE TABLE product_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_product_categories_name CHECK (btrim(name) <> '')
);
-- Không phân biệt hoa thường: "Nước khoáng" và "nước khoáng" là một loại.
CREATE UNIQUE INDEX uq_product_categories_name ON product_categories (lower(name));

-- Thứ tự thêm cũng là thứ tự hiện trên bộ lọc.
INSERT INTO product_categories (name) VALUES
    ('Tinh khiết'),
    ('Nước khoáng'),
    ('Ion kiềm'),
    ('Hoàn lưu khoáng'),
    ('Nước có ga'),
    ('Bù khoáng & điện giải'),
    ('Vỏ bình & phụ kiện');

ALTER TABLE products ADD COLUMN category_id BIGINT REFERENCES product_categories(id);
CREATE INDEX idx_products_category_id ON products(category_id);

-- Loại nước đã lưu chuyển sang loại sản phẩm cùng tên.
UPDATE products p
SET category_id = c.id
FROM product_categories c
WHERE p.water_type IS NOT NULL
  AND c.name = CASE p.water_type
      WHEN 'PURIFIED' THEN 'Tinh khiết'
      WHEN 'MINERAL' THEN 'Nước khoáng'
      WHEN 'ALKALINE' THEN 'Ion kiềm'
      WHEN 'REMINERALIZED' THEN 'Hoàn lưu khoáng'
      WHEN 'SPARKLING' THEN 'Nước có ga'
      WHEN 'ELECTROLYTE' THEN 'Bù khoáng & điện giải'
      WHEN 'CONTAINER' THEN 'Vỏ bình & phụ kiện'
  END;

-- Sản phẩm chưa lưu loại nước: trước đây giao diện tự đoán loại từ tên sản phẩm.
-- Lưu lại đúng phần đoán đó để khách vẫn thấy danh mục như cũ; từ nay cửa hàng sửa được trong form sản phẩm.
-- Cùng thứ tự ưu tiên với inferCatalog ở frontend; không khớp mẫu nào thì để trống (chưa phân loại).
UPDATE products p
SET category_id = c.id
FROM product_categories c
WHERE p.category_id IS NULL
  AND c.name = CASE
      WHEN lower(p.unit) = 'vỏ' OR p.name ~* '^vỏ ' THEN 'Vỏ bình & phụ kiện'
      WHEN p.name ~* '(có ga|có gas|soda)' THEN 'Nước có ga'
      WHEN p.name ~* '(pocari|revive|bù khoáng|muối khoáng|bổ sung ion)' THEN 'Bù khoáng & điện giải'
      WHEN p.name ~* 'hoàn lưu' THEN 'Hoàn lưu khoáng'
      WHEN p.name ~* 'kiềm' THEN 'Ion kiềm'
      WHEN p.name ~* 'khoáng' THEN 'Nước khoáng'
      WHEN p.name ~* 'tinh khiết' THEN 'Tinh khiết'
  END;

-- Giữ lại cột cũ để bản backend trước đó vẫn chạy được trên cùng database trong lúc chuyển đổi; xóa ở migration sau.
COMMENT ON COLUMN products.water_type IS 'Không dùng nữa, thay bằng category_id (V29).';

-- Mã sản phẩm tự sinh khi nhân viên để trống: SP00001, SP00002, ... (bỏ qua số đã có người nhập tay).
CREATE SEQUENCE product_sku_seq;
