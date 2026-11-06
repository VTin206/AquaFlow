# Thanh toán và công nợ

## Quy tắc

- ADMIN và SALES_STAFF ghi nhận tiền thực thu/hoàn bằng tiền mặt hoặc chuyển khoản. Đây là ghi sổ, không tích hợp cổng thanh toán hoặc tự chuyển tiền ngân hàng.
- Thu từng phần hoặc toàn bộ số còn phải thu trên đơn đã xác nhận. Chặn đơn PENDING/CANCELLED, số tiền <= 0, vượt số dư, và quá 2 chữ số thập phân.
- Tiền tài xế thu dùng chung `payments`/`payment_allocations`, không tạo sổ thu thứ hai. Tồn kho và trạng thái giao hàng không thay đổi khi thanh toán; DELIVERED không tự chuyển COMPLETED.
- Công nợ khách gồm các đơn đã xác nhận và chưa hủy. Đơn chờ xác nhận không tính vào công nợ. Khách đã lưu trữ vẫn hiện trong bảng Công nợ và tiền cần hoàn.
- Khi hủy đơn, số còn phải thu bằng 0; tiền đang giữ trở thành số cần hoàn. Hoàn tiền bằng phiếu OUT mới, bắt buộc lý do, không vượt số đang giữ. Chỉ cho hoàn sau khi đơn đã hủy (bao gồm hủy sau kiểm nhận hàng hoàn). Không tự hoàn khi báo giao thất bại.
- Không sửa/xóa phiếu đã ghi nhận. Hoàn một phần/đủ tiền giữ nguyên phiếu thu ban đầu. Không bù trừ khoản cần hoàn của đơn này vào nợ của đơn khác.
- Chỉ tiền SALE tính vào nợ tiền hàng; DEPOSIT thuộc tính năng sổ vỏ/cọc riêng.

## REST API

Các endpoint dưới `/api/v1/sales` chỉ ADMIN/SALES_STAFF được truy cập.

| Method | Path | Chức năng |
| --- | --- | --- |
| GET | `/orders/{id}/payments` | Số dư và lịch sử thu/hoàn (gồm thu khi giao hàng) |
| POST | `/orders/{id}/payments` | Ghi phiếu, trả 201 + Location |
| GET | `/orders/{orderId}/payments/{id}` | Chi tiết phiếu |
| GET | `/order-balances` | Số dư tất cả đơn để hiển thị danh sách |
| GET | `/customer-balances` | Tổng còn phải thu/cần hoàn từng khách, gồm khách lưu trữ |
| GET | `/customers/{id}/receivables` | Các đơn còn phải thu/cần hoàn của khách |

POST body: `requestId` UUID, `direction` IN/OUT, `amount`, `method` CASH/BANK_TRANSFER, `reference` (mã giao dịch nếu có, duy nhất), `note` (ghi chú/lý do, bắt buộc OUT). Reference và note tối đa 200 ký tự. Lý do hoàn tiền được lưu riêng để có thể lặp lại mà không vi phạm ràng buộc mã giao dịch duy nhất.

Khóa hàng đơn trong transaction dùng chung với luồng tài xế để chặn thu/hoàn vượt số dư khi thao tác đồng thời. Cùng requestId và nội dung trả lại phiếu cũ; đổi nội dung hoặc người ghi trả 409. Việc tạo phiếu, allocation và trạng thái thanh toán rollback cùng nhau. FE giữ requestId khi thử lại cùng nội dung sau lỗi mạng.

V22 thêm idempotency key, view số dư và trigger đồng bộ trạng thái thanh toán khi trạng thái/giá trị đơn thay đổi (hủy, xử lý hàng hoàn, giao lại). Không chỉnh V1–V4. Thông tin thanh toán không thay đổi trạng thái fulfillment.

## Kiểm tra giao diện

1. Đơn hàng → mở đơn đã xác nhận → Thanh toán → Ghi nhận thu tiền.
2. Thu một phần, kiểm tra số còn phải thu trên chi tiết/danh sách/in hóa đơn và hồ sơ khách.
3. Nếu tài xế đã thu, lịch sử có nhãn Thu khi giao hàng, chỉ thu được phần còn lại.
4. Hủy đơn đang giữ tiền → Ghi nhận hoàn tiền → nhập số tiền và lý do.
5. Khách hàng → Công nợ và tiền cần hoàn → chọn khách → mở đơn để thu/hoàn. Khách lưu trữ vẫn hiển thị nếu còn số dư.

Kiểm thử BE chạy trên database riêng, không tạo giao dịch vận hành. Bao gồm thu nhiều lần, idempotency, giới hạn số tiền, hoàn tiền, rollback, đồng thời, khách lưu trữ, loại trừ cọc, quyền truy cập và dùng chung số dư tài xế. FE có kiểm thử số tiền thực còn nợ, retry, lý do hoàn và phân quyền.
