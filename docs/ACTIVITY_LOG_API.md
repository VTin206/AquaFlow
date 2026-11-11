# Nhật ký hoạt động

Chỉ ADMIN được đọc. Các role khác trả 403; chưa đăng nhập trả 401.

| Method | Resource | Mô tả |
| --- | --- | --- |
| GET | `/api/v1/admin/activity-logs` | Phân trang, sắp xếp created_at DESC, id DESC |
| GET | `/api/v1/admin/activity-logs/{id}` | Chi tiết hoặc 404 |
| GET | `/api/v1/admin/activity-logs/actors` | Người đã có nhật ký, bao gồm tài khoản ngừng hoạt động |

Filters: `area` (ORDERS, INVENTORY, DELIVERY, CUSTOMERS, SUPPLIERS, SETTINGS, OTHER), `actorId` dương, `from` bao gồm / `to` không bao gồm (ISO timestamp), `q` tối đa 200 ký tự tìm chuỗi con không phân biệt hoa thường, `page` 0–100000, `size` 1–100 (mặc định 20). Sai bộ lọc trả 400. Kết quả `{content,page,size,totalElements}`. Không hỗ trợ API tạo/sửa/xóa nhật ký.

Mỗi entry: `id, at, actorId, actorName, area, action, entityType, entityId, target, reason`. API không trả before_json/after_json để tránh đưa thông tin cá nhân trong snapshot ra giao diện. Không lưu token, mật khẩu, request body hoặc response body mới.

Ghi nhật ký bằng advisor Spring AOP với danh sách service cụ thể: OrderService, OrderDispatchService, InventoryReturnService, ProductService, BottleTypeService, SupplierService, PurchaseReceiptService, CustomerService, CustomerAddressService và DeliveryService. Chỉ intercept phương thức ghi có @Transactional. Một transaction REQUIRED bên ngoài bao trùm cả nghiệp vụ và INSERT nhật ký; lỗi nghiệp vụ, lỗi lưu nhật ký hoặc rollback ngoài đều rollback cùng nhau. Không ghi khi Optional rỗng hoặc boolean false. Các thao tác đọc không ghi. Các lệnh lặp idempotent trả thành công có thể có nhật ký lệnh mới nhưng không lặp tác động nghiệp vụ.

UPDATE khách hàng/địa chỉ và cài đặt tiếp tục dùng audit có sẵn, không ghi thêm bản trùng. `findOrCreateForUser` (tra cứu hoặc tạo hồ sơ nội bộ) và các helper giữ hàng/giải phóng hàng không ghi riêng. Actor lấy từ principal đăng nhập; tác vụ hệ thống hoặc khách chưa đăng nhập có actorId=null. Thao tác mới được ghi kể từ khi chạy bản này; không dựng lịch sử giả cho thời gian trước đó. Lịch sử audit_logs cũ vẫn đọc được.

FE /activity: dữ liệu thật cho tài khoản thật, demo giữ dữ liệu mẫu; bộ lọc server, phân trang, tự làm mới 15 giây, chi tiết và CSV **trang hiện tại**. Bộ lọc ngày đổi từ ngày địa phương của trình duyệt sang UTC [from,to). CSV vô hiệu hóa ô có thể được bảng tính hiểu là công thức. Thanh toán chưa có API nên không hiển thị mục nhật ký thanh toán giả.

Migration V13 chỉ bổ sung index theo thời gian và actor. Không thay đổi migration cũ.

Kiểm tra: đăng nhập ADMIN → tạo/cập nhật sản phẩm hoặc nhà cung cấp, xuất kho/hoàn hàng/chuyển trạng thái đơn/giao hàng → mở Nhật ký → tìm theo khu vực/người/ngày, xem chi tiết và xuất trang CSV. Thử thao tác nghiệp vụ lỗi: không được có nhật ký thành công. Test PostgreSQL kiểm quyền, phân trang, biên thời gian, tìm ký tự đặc biệt, actor và rollback nguyên tử.

Nhật ký của một đơn cho nhân viên bán hàng (ADMIN, SALES_STAFF): `GET /api/v1/sales/orders/{id}/activity`, gộp nhật ký gắn với đơn (cột `order_id`, V28) và phiếu thu/hoàn. Chi tiết: [UNLOCKED_FEATURES_API.md](UNLOCKED_FEATURES_API.md).
