# Sổ vỏ bình và tiền cọc

Vào **Khách hàng → Quản lý vỏ bình / tiền cọc**, hoặc mở hồ sơ khách → **Vỏ & cọc**.
Danh mục loại vỏ dùng API hiện có; sổ giao dịch dùng API thật. Sổ tổng hợp bao gồm khách đã lưu trữ.

## Nghiệp vụ

- ADMIN/SALES_STAFF xem sổ, giao vỏ, thu vỏ và thu cọc. Chỉ ADMIN được hoàn cọc và báo mất/vỡ. CUSTOMER/DELIVERY_STAFF không truy cập API sổ quản trị.
- Giao/thu vỏ chọn đúng loại và số lượng. Giao vỏ phải ghi lý do/mã đơn đối chiếu. Không giao thêm cho khách hoặc loại vỏ đã ngừng hoạt động, nhưng vẫn được thu hồi và hoàn cọc.
- Đây là sổ ghi nhận **thực tế bằng tay**: giao đơn hay ghi số vỏ tài xế thu trong chuyến chưa tự tạo giao dịch sổ này. Nhân viên đối chiếu đơn/chuyến và ghi đúng một lần, theo loại vỏ thực nhận. Không suy đoán loại vỏ từ tổng số vỏ tài xế nhập.
- Thu vỏ không tự hoàn tiền. Tiền được hoàn tối đa = cọc đang giữ − nghĩa vụ cọc của vỏ chưa trả (không âm).
- Nghĩa vụ cọc được chốt khi giao vỏ; khi trả/mất vỏ, giải phóng theo giá trị bình quân đang giữ của cùng loại. Trả hết giải phóng toàn bộ. Đổi giá danh mục không thay đổi giao dịch cũ.
- Mất/vỡ bắt buộc lý do; giảm vỏ và cấn trừ cọc tương ứng, tối đa cọc đang giữ. Phần chưa đủ không tự tạo công nợ mua nước. Báo cáo tách tiền cấn trừ khỏi tiền hoàn khách.
- Thu/hoàn cọc ghi sau khi đã thực tế trao tiền, không thực hiện chuyển khoản ngân hàng. Tiền cọc không ghi vào payments/SALE, không làm đơn hàng được thanh toán và không thay đổi tồn kho nước.
- Không sửa/xóa lịch sử. API khóa khách trong transaction, kiểm tra số dư và UUID chống ghi trùng. Retry cùng UUID phải giữ nguyên nội dung và người ghi.

## REST API

- `GET /api/v1/sales/bottle-balances`: số dư tất cả khách.
- `GET /api/v1/sales/customers/{id}/bottle-ledger`: số dư, từng loại vỏ, lịch sử/người ghi.
- `POST /api/v1/sales/customers/{id}/bottle-transactions`: 201 + Location.
- `GET /api/v1/sales/customers/{id}/bottle-transactions/{requestId}`: chứng từ theo UUID.

Body giao/thu/mất vỏ: `{ "requestId": "UUID", "kind": "GIVE|RECEIVE|LOSS", "bottleTypeId": 1, "quantity": 2, "note": "Đối chiếu DH..." }`.
Body thu/hoàn tiền: `{ "requestId": "UUID", "kind": "COLLECT|REFUND", "amount": 50000, "note": "Lý do" }`.
Không gửi trường số tiền cho giao dịch vỏ; không gửi loại/số lượng vỏ cho giao dịch tiền.

V23 mở rộng bảng bottle_transactions/deposit_transactions sẵn có, không sửa V1–V4. Dòng lịch sử trước V23 giữ nguyên, nghĩa vụ mở đầu tính theo giá danh mục tại lúc migration.

## Kiểm thử chính

1. Giao 2 vỏ giá 50.000, thu cọc 100.000: có thể hoàn 0.
2. Đổi giá danh mục thành 99.000; thu 1 vỏ: vẫn chỉ giải phóng 50.000.
3. Hoàn 50.000: còn giữ 1 vỏ, cọc 50.000. Vượt số dư trả 409.
4. Báo mất/vỡ: giảm số vỏ và tiền cọc bằng một transaction, phân biệt tiền hoàn trong báo cáo.
5. Retry/chạy đồng thời không nhân đôi hoặc làm số dư âm; rollback không để lại dòng dở dang.
6. SALES_STAFF không gọi được REFUND/LOSS; tài xế và khách hàng bị 403.
