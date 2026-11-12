# Loại sản phẩm và mã sản phẩm tự sinh

Migration: `V29__product_categories_and_sku_sequence.sql`.

## 1. Loại sản phẩm

Cửa hàng tự thêm, đổi tên, ngừng dùng / dùng lại và xóa loại sản phẩm (Tinh khiết, Nước khoáng...). Loại dùng để phân loại
và lọc ở trang Sản phẩm và trang mua hàng.

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/v1/product-categories?active=` | Danh sách theo thứ tự tạo. Bỏ `active` là lấy tất cả. |
| POST | `/api/v1/product-categories` | `{ "name": "..." }` → 201. |
| PUT | `/api/v1/product-categories/{id}` | `{ "name": "...", "active": false }`. `active` bỏ trống thì giữ nguyên. |
| DELETE | `/api/v1/product-categories/{id}` | 204. Còn sản phẩm thuộc loại này thì 409. |

- Quyền: `ADMIN`, `SALES_STAFF`. Khách và người chưa đăng nhập không gọi API này; trang khách đọc `categoryName` trong
  `ProductResponse`.
- Response: `{ id, name, active, productCount }`. `productCount` gồm cả sản phẩm đã ngừng bán.
- Tên tối đa 80 ký tự, bỏ khoảng trắng thừa, không trùng (không phân biệt hoa thường) → 409.
- Ngừng dùng: không gán được cho sản phẩm khác (409), sản phẩm đang thuộc loại đó vẫn giữ và vẫn lưu lại được.

Migration tạo sẵn 7 loại cũ của `water_type` theo thứ tự trên bộ lọc, chuyển giá trị `water_type` đã lưu sang loại cùng tên,
và với sản phẩm chưa lưu thì gán theo tên sản phẩm đúng như giao diện đã đoán trước đây (không khớp thì để trống).
Cột `products.water_type` giữ lại, không dùng nữa, để bản backend cũ chạy được trên cùng database trong lúc chuyển đổi;
sẽ xóa ở migration sau.

## 2. Mã sản phẩm tự sinh

`CreateProductRequest.sku` không còn bắt buộc. Để trống hoặc không gửi thì backend cấp `SP00001`, `SP00002`... từ sequence
`product_sku_seq`, bỏ qua số trùng với mã đã nhập tay. Nhập tay thì vẫn phải duy nhất (409) như trước.
