# Kế hoạch phân công nhóm

## Tổng kết Sprint 1

- Phạm vi chính: xác thực/phân quyền bằng JWT; quản lý Product, BottleType, Supplier, Customer và địa chỉ; backend REST API cùng Flyway; frontend đăng nhập và tích hợp API cho các màn hình quản lý liên quan.
- Báo cáo review ngày 22/10/2026 ghi nhận sau các cập nhật: `mvn -B -ntp clean verify` đạt 124 test, không lỗi/thất bại, nhưng 3 test bị skip do thiếu PostgreSQL/`DB_URL`. Frontend lint, typecheck, test và build đều đạt tại thời điểm review.
- Các kết quả trên là bằng chứng lịch sử, không phải lần chạy lại hiện tại. Báo cáo chưa xác nhận E2E FE–BE với PostgreSQL thật hoặc GitHub Actions; vì vậy kết luận khi đó là **chưa đủ điều kiện merge**.
- Việc cần theo dõi từ review: xác minh migration V2 với dữ liệu hiện hữu; chạy CI trên môi trường Java/Node/PostgreSQL phù hợp; kiểm thử luồng đăng nhập và CRUD xuyên suốt; rà soát truy vấn N+1 ở Order và lưu token trong `localStorage`; chốt ERD/API contract với nhóm.
- API contract chi tiết được giữ riêng tại `docs/SPRINT1_API_CONTRACT.md`.

## Phạm vi các Sprint

### Sprint 2 – Đặt hàng và quản lý tồn kho

- Giỏ hàng, checkout, guest checkout và đặt hàng có tài khoản.
- Tạo, xem và quản lý đơn hàng; xác nhận, chuẩn bị và hủy theo quy tắc nghiệp vụ.
- Nhập kho, quản lý lô hàng/hạn sử dụng, FEFO, giữ và hoàn trả tồn kho.
- Bảo vệ transaction, concurrency và ngăn bán vượt tồn.
- Dispatch/xuất kho thực tế, delivery/giao hàng, Payment và public order tracking không thuộc Sprint 2.

### Sprint 3 – Xuất kho và giao hàng

- Xuất kho thực tế, cập nhật lượng đã xuất và reservation đã dispatch.
- Điều phối giao hàng, cập nhật trạng thái `OUT_FOR_DELIVERY` và `DELIVERED`.
- Xử lý giao hàng thất bại theo tình trạng hàng thực tế.

### Sprint 4 – Thanh toán và hoàn tất đơn hàng

- Payment diễn ra ở bước cuối, sau khi giao hàng thành công; ghi nhận và xác nhận giao dịch, đối soát, xử lý thiếu/thất bại và hoàn tiền theo chính sách.
- Hoàn tất đơn khi các điều kiện nghiệp vụ được đáp ứng.
- Order status và payment status phải được quản lý tách biệt; `PAID` không thay thế vòng đời trạng thái đơn hàng.

Public order tracking chưa thuộc phạm vi đã thống nhất; chỉ bổ sung khi nhóm/Product Owner quyết định rõ.

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
