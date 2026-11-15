# Bổ sung các thao tác còn thiếu (thêm/sửa/hủy)

Trạng thái: kế hoạch, chờ nhóm backend duyệt trước khi làm.

Phạm vi: các chỗ thiếu thao tác phát hiện khi rà API ngày 15/11/2026. Mỗi mục gồm API backend, giao diện và test. Một migration mới `V32` (`V31` đã dùng cho bài viết shop); không sửa migration cũ. Chỉ chạy thử trên database test local, không chạy trên database dùng chung trước khi merge.

| # | Mục | API | Quyền |
|---|---|---|---|
| 1 | Đổi tên loại vỏ | `PUT /api/v1/bottle-types/{id}` nhận thêm `name` (không bắt buộc, trùng tên → 409) | ADMIN |
| 2 | Khách tự hủy đơn | `POST /api/v1/customer/orders/{id}/cancel` | Khách sở hữu đơn |
| 3 | Điều chỉnh tồn / kiểm kê theo lô | `POST /api/v1/inventory/adjustments` | ADMIN |
| 4 | Hủy phiếu thu ghi nhầm | `POST /api/v1/sales/orders/{orderId}/payments/{id}/void` | ADMIN |
| 5 | Hủy giao dịch vỏ/cọc ghi nhầm | `POST /api/v1/sales/customers/{id}/bottle-transactions/{requestId}/void` | ADMIN |
| 6 | Sửa đơn chờ xác nhận | `PUT /api/v1/sales/orders/{id}` | ADMIN, SALES_STAFF |

## 1. Đổi tên loại vỏ

- `name` tùy chọn; có thì cắt khoảng trắng, tối đa như khi tạo, không trùng tên loại khác (không phân biệt hoa thường).
- Tiền cọc vẫn bắt buộc như hiện tại. Đổi tên không đổi số vỏ hay cọc đã ghi.

## 2. Khách tự hủy đơn

- Chỉ đơn của chính khách, đang `PENDING` (chưa giữ hàng). Trạng thái khác → 409.
- Dùng lại chuyển trạng thái `CANCELLED` sẵn có; đơn đã thu tiền thì trạng thái thanh toán tự thành "Chờ hoàn tiền" như khi nhân viên hủy.

## 3. Điều chỉnh tồn theo lô

- Body: `batchId`, `countedQuantity` (số đếm thực tế, ≥ 0), `reason` (bắt buộc).
- Chênh lệch = số đếm − tồn hiện có. Bằng 0 → 400. Tăng → `ADJUST_UP`; giảm → `ADJUST_DOWN`, không được giảm xuống dưới số đang giữ cho đơn (409).
- Lưu bảng `stock_adjustments` (lô, tồn trước, số đếm, lý do, người làm, thời điểm); sổ kho ghi `reference_type = ADJUSTMENT`, mã chứng từ `DC-00001`.
- Báo cáo nhập – xuất – tồn đã đọc `ADJUST_UP/DOWN` nên tự có số.

## 4. Hủy phiếu thu

- Body: `reason` (bắt buộc). Phiếu chuyển `REJECTED`, ghi `voided_by`, `voided_at`, `void_reason`. Mọi số dư, công nợ, báo cáo vốn chỉ tính `CONFIRMED` nên tự loại phiếu này.
- Không hủy được phiếu thu do tài xế nộp trong đối soát chuyến (409), vì đã khớp với tiền chuyến.
- Sau khi hủy, cập nhật lại trạng thái thanh toán của đơn.

## 5. Hủy giao dịch vỏ/cọc

- Body: `requestId` (UUID, chống bấm hai lần), `reason`.
- Ghi một giao dịch `VOID` đảo đúng số vỏ, cọc và nghĩa vụ cọc của giao dịch gốc (`voids_request_id`, mỗi giao dịch chỉ hủy một lần). Lịch sử vẫn giữ cả hai dòng.
- Chặn nếu đảo làm số vỏ khách giữ hoặc cọc đang giữ âm (409).

## 6. Sửa đơn chờ xác nhận

- Chỉ đơn `PENDING`. Sửa được: người nhận, số điện thoại, địa chỉ, khu vực, giờ hẹn, ghi chú, danh sách hàng và số lượng.
- Tính lại tiền hàng theo giá hiện tại; phí giao giữ nguyên (nhân viên đã báo phí với khách). Tổng mới nhỏ hơn số đã thu → 409.
- Đơn chưa giữ hàng nên không đụng tồn kho.

## Giao diện

- Loại vỏ: cửa sổ sửa có ô Tên.
- Theo dõi đơn của khách: nút "Hủy đơn" khi đơn còn chờ xác nhận.
- Kho → Lô hàng: nút "Kiểm kê" mỗi lô, nhập số đếm thực tế và lý do.
- Chi tiết đơn → Thanh toán: nút hủy phiếu thu (ADMIN), nhập lý do.
- Hồ sơ khách → Sổ vỏ và cọc: nút hủy giao dịch (ADMIN), nhập lý do.
- Chi tiết đơn chờ xác nhận: nút "Sửa đơn" mở form tạo đơn với dữ liệu sẵn.
