# Kế hoạch phân công nhóm

## Backend

- Backend 1: Authentication & User Management; Spring Security, JWT, role/permission.
- Backend 2: Product, Supplier & Inventory; nhập kho, tồn kho, cảnh báo sắp hết.
- Backend 3: Customer & Order; khách hàng, tạo đơn, tính tiền, trạng thái đơn.

## Frontend

- Frontend 1: Layout, dashboard, design system, authentication screens.
- Frontend 2: Order, inventory, customer, delivery screens và API integration.

## Quy ước nhánh Git

- `main`: code ổn định đã review.
- `develop`: tích hợp các tính năng hoàn thành.
- `feature/<module>-<short-name>`: nhánh cá nhân cho từng task.
- `fix/<short-name>`: sửa lỗi.

## Definition of Done tối thiểu

- Code compile/build thành công.
- Có test cho logic nghiệp vụ chính.
- API có DTO và validation phù hợp.
- Có Flyway migration nếu thay đổi dữ liệu.
- Pull request đã được ít nhất một thành viên review.
