# Lịch sử xuất / nhập kho

Tab **Kho hàng → Xuất / nhập kho** đọc sổ `inventory_movements` thật, độc lập với chức năng kiểm hàng hoàn.
Không còn phụ thuộc cờ `deliveryReturns`; tài khoản thật không đọc mock.

## REST API

Chỉ `ADMIN` và `SALES_STAFF` được đọc; JWT bắt buộc.

- `GET /api/v1/inventory/movements`: danh sách phân trang.
- `GET /api/v1/inventory/movements/{id}`: chi tiết một giao dịch.

Query parameters:

| Tham số | Ý nghĩa |
| --- | --- |
| `page` | Bắt đầu từ 0, mặc định 0, tối đa 100000 |
| `size` | 1–100, mặc định 20 |
| `type` | RECEIVE, COUNTER_SALE, DISPATCH, RETURN, ADJUST_UP, ADJUST_DOWN |
| `productId` | ID sản phẩm, phải dương |
| `from` | ISO timestamp có múi giờ, bao gồm mốc bắt đầu |
| `to` | ISO timestamp có múi giờ, không bao gồm mốc kết thúc |
| `q` | Tối đa 200 ký tự, tìm tên/mã sản phẩm, lô, mã chứng từ, người thực hiện |

FE chuyển khoảng ngày địa phương thành `[đầu ngày đầu, đầu ngày sau ngày cuối)` để không bỏ sót giao dịch cuối ngày.
Danh sách trả `{content, page, size, totalElements}`, sắp `occurredAt DESC, id DESC`.

Mỗi dòng có `id`, `type`, `quantity` (dương), `signedQuantity` (nhập dương/xuất âm), `occurredAt`,
`productId`, `productName`, `sku`, `unit`, `batchId`, `lotCode`, `expiresOn`,
`referenceType`, `referenceId`, `referenceCode`, `performedBy`, `performedByName`, `reason`.
Sản phẩm đã ngừng kinh doanh vẫn xuất hiện trong lịch sử.

## Nguồn ghi sổ

- Xác nhận phiếu nhập hiện có ghi `RECEIVE`, chứng từ `PURCHASE_RECEIPT`.
- Dispatch đơn giao ghi `DISPATCH`; giao tại quầy ghi `COUNTER_SALE`, chứng từ `ORDER`.
- Khởi hành chuyến không xuất kho lần nữa và không tạo thêm giao dịch.
- Sổ là dữ liệu chỉ đọc: không có POST/PUT/DELETE trực tiếp để tùy ý sửa tồn.
  Nhập hàng qua phiếu nhập, xuất hàng qua Dispatch; nghiệp vụ ghi sổ cùng transaction với tồn kho.
- Nếu có bản ghi RETURN/ADJUST từ nghiệp vụ khác, API vẫn đọc đúng chiều biến động.
  Thay đổi này không triển khai mới thao tác kiểm hàng hoàn hay điều chỉnh kho.

Mã lỗi: `400` bộ lọc không hợp lệ; `401` chưa đăng nhập; `403` sai quyền;
`404` không có giao dịch; `405` thao tác ghi không được hỗ trợ.
Migration V11 tạo chỉ mục phục vụ đọc lịch sử theo thời gian.

## FE và kiểm thử

Bảng có lọc loại, ngày, tìm kiếm, phân trang server, tải lại, lỗi/thử lại và trạng thái rỗng.
Nhấn mã chứng từ để xem chi tiết giao dịch; giao dịch từ đơn có nút xem đơn hàng.
Dữ liệu tự tải lại mỗi 15 giây và dùng khóa `live` để cập nhật sau nhập/xuất kho.

`InventoryMovementPostgresIntegrationTest`: phân trang/thứ tự, bộ lọc và biên thời gian,
tìm kiếm ký tự đặc biệt, dấu số lượng, sản phẩm ngừng bán, chứng từ, người thực hiện, HTTP và phân quyền.
`DispatchPostgresIntegrationTest` xác minh xuất thật hai lô tạo hai dòng lịch sử và tổng lượng âm đúng.
`frontend/tests/movement-api.test.mjs`: HTTP contract, query encoding, phân trang và lỗi 404.
