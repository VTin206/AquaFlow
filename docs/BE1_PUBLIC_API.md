# AquaFlow — BE1 Public API & Security

Phạm vi: Sprint 2 BE1 trên branch `feat/be-public-api`. Tài liệu này mô tả các endpoint đang có trong source, không tạo thêm endpoint Order thuộc BE3.

## Public product catalog

Base path: `/api/v1`

| Method | Endpoint | Guest | ADMIN | SALES_STAFF | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| GET | `/products` | Cho phép | Cho phép | Cho phép | Guest/Sales luôn nhận `active=true`, kể cả khi gửi `?active=false` |
| GET | `/products/{id}` | Cho phép nếu active | Cho phép cả active/inactive | Cho phép nếu active | Inactive với Guest/Sales trả `404`, không làm lộ bản ghi quản trị |
| GET | `/bottle-types` | Cho phép theo contract Sprint 1 | Cho phép | Cho phép | Catalog phụ trợ hiện hữu; không chứa tồn kho/chi phí nhập |
| GET | `/bottle-types/{id}` | Cho phép theo contract Sprint 1 | Cho phép | Cho phép | Không thay đổi endpoint |

Response Product dùng `ProductResponse`: `id`, `sku`, `name`, `brand`, `unit`, `unitsPerCase`, `bottleTypeId`, `bottleTypeName`, `salePrice`, `active`, `createdAt`. Không có password, tồn kho, giá nhập, lô hàng hay thông tin quản trị khác.

## Protected API matrix

| Khu vực | ADMIN | SALES_STAFF | Guest |
| --- | --- | --- | --- |
| Product/BottleType ghi dữ liệu | Có | 403 | 401 |
| Supplier đọc | Có | Có | 401 |
| `/api/v1/sales/**` hiện hữu | Có | Có | 401 |
| `/api/v1/admin/**` | Có | 403 | 401 |
| `/api/v1/delivery/**` | Có | 403 | 401 |

`401` là thiếu/sai JWT; `403` là JWT hợp lệ nhưng thiếu role. Validation request trả `400`; xung đột dữ liệu trả `409`.

## Guest Order dependency — BE3

Hiện source chỉ có `GET /api/v1/sales/orders` và `GET /api/v1/sales/orders/{id}`. Chưa có API tạo yêu cầu đặt hàng cho khách chưa đăng nhập và chưa có endpoint path được chốt trong API Contract.

BE1 **không tự tạo hoặc tự đoán endpoint Order**. BE3 cần chốt contract (path, request DTO, chống spam/idempotency, rate limit và response) rồi bổ sung một matcher `permitAll` chỉ cho đúng `POST` endpoint đó. Các endpoint quản trị/nhân viên vẫn phải giữ authentication và role matcher hiện tại.

## Security notes

- JWT vẫn là bearer token stateless; role được lấy lại từ user hiện tại, không tin role claim đơn độc.
- Public matcher chỉ khai báo collection/detail route hiện hữu, tránh mở nhầm sub-resource mới.
- CORS local cho cả `http://localhost:5173` và `http://127.0.0.1:5173`; production cần cấu hình origin cụ thể theo môi trường.
