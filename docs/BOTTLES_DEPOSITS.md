# Sổ vỏ bình và tiền cọc

Vào **Khách hàng → Quản lý vỏ bình / tiền cọc**, hoặc mở hồ sơ khách → **Vỏ & cọc**.
Danh mục loại vỏ dùng API hiện có; sổ giao dịch dùng API thật. Sổ tổng hợp bao gồm khách đã lưu trữ.

Trang đặt hàng lấy `bottleTypeId` của sản phẩm và giá cọc từ `GET /api/v1/bottle-types?active=true`, gộp số lượng theo loại vỏ. Hiển thị cọc dự kiến nếu khách không đổi vỏ, tách khỏi tiền hàng; không ghi thu cọc khi gửi đơn. Giá được tải lại khi mở trang, quay lại cửa sổ và mỗi 30 giây. Nếu thiếu giá hoặc API lỗi, trang không hiển thị tổng cọc suy đoán và cho phép tải lại. Mức cọc cố định chỉ dùng trong bản Demo.

## Nghiệp vụ

- ADMIN/SALES_STAFF xem sổ, giao vỏ, thu vỏ và thu cọc. Chỉ ADMIN được hoàn cọc và báo mất/vỡ. CUSTOMER/DELIVERY_STAFF không truy cập API sổ quản trị.
- Giao/thu vỏ chọn đúng loại và số lượng. Giao vỏ phải ghi lý do/mã đơn đối chiếu. Không giao thêm cho khách hoặc loại vỏ đã ngừng hoạt động, nhưng vẫn được thu hồi và hoàn cọc.
- Chuyến khởi hành sau V24 chốt khách hàng, từng loại vỏ, số lượng và giá cọc từ danh sách hàng lên xe. Khi giao SUCCESS, vỏ tự ghi vào sổ khách trong cùng transaction với kết quả giao; FAILED không tăng vỏ. Không nhập lại bằng tay những dòng tự động này.
- Tại `/driver` hoặc chi tiết chuyến `/delivery`, chọn **Vỏ của đơn**, nhập số vỏ thực thu theo loại sau khi giao thành công. Sổ khách và số vỏ cần bàn giao chuyến cùng cập nhật; không cần nhập lại ở hồ sơ khách. API thu tiền cũ chỉ nhận `bottlesReturned=0` cho phiếu mới; phiếu vỏ dùng API riêng có loại vỏ.
- Chuyến khởi hành trước V24 và đơn không gắn khách hàng không tự bổ sung lịch sử. Giao diện yêu cầu đối chiếu thủ công; tránh cộng trùng sổ đã nhập tay. Giao vỏ tại quầy/ngoài đơn vẫn dùng sổ thủ công.
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
- `GET /api/v1/delivery/assignments/{id}/bottles`: số vỏ đã chốt, số đã thu, giá cọc chốt lúc khởi hành và lịch sử thu vỏ.
- `GET /api/v1/delivery/assignments/{id}/bottle-returns/{requestId}`: phiếu thu vỏ theo UUID; đây là Location trả về khi POST thành công.
- `POST /api/v1/delivery/assignments/{id}/bottle-returns`: body `{ "requestId": "UUID", "lines": [{ "bottleTypeId": 1, "quantity": 2 }] }`. Chỉ tài xế của chuyến hoặc ADMIN/SALES_STAFF; chặn loại trùng, số âm, thu vượt số đã giao của từng loại, thu trước SUCCESS hoặc sau đối soát. UUID giữ nguyên khi retry; payload đổi phải dùng UUID khác.

Body giao/thu/mất vỏ: `{ "requestId": "UUID", "kind": "GIVE|RECEIVE|LOSS", "bottleTypeId": 1, "quantity": 2, "note": "Đối chiếu DH..." }`.
Body thu/hoàn tiền: `{ "requestId": "UUID", "kind": "COLLECT|REFUND", "amount": 50000, "note": "Lý do" }`.
Không gửi trường số tiền cho giao dịch vỏ; không gửi loại/số lượng vỏ cho giao dịch tiền.

V23 mở rộng bảng bottle_transactions/deposit_transactions sẵn có, không sửa V1–V4. Dòng lịch sử trước V23 giữ nguyên, nghĩa vụ mở đầu tính theo giá danh mục tại lúc migration.
V24 thêm bản chốt vỏ theo assignment và phiếu thu theo loại; không backfill chuyến cũ. Giao lại dùng assignment mới và không thay đổi lịch sử chuyến thất bại.

## Kiểm thử chính

1. Giao 2 vỏ giá 50.000, thu cọc 100.000: có thể hoàn 0.
2. Đổi giá danh mục thành 99.000; thu 1 vỏ: vẫn chỉ giải phóng 50.000.
3. Hoàn 50.000: còn giữ 1 vỏ, cọc 50.000. Vượt số dư trả 409.
4. Báo mất/vỡ: giảm số vỏ và tiền cọc bằng một transaction, phân biệt tiền hoàn trong báo cáo.
5. Retry/chạy đồng thời không nhân đôi hoặc làm số dư âm; rollback không để lại dòng dở dang.
6. SALES_STAFF không gọi được REFUND/LOSS; tài xế và khách hàng bị 403.
7. Với đơn DELIVERY có hồ sơ khách và sản phẩm gắn loại vỏ: Dispatch → khởi hành → giao thành công. Mở **Vỏ của đơn** và sổ khách: số vỏ chỉ tăng một lần, đúng loại và giá cọc khi khởi hành. Giao thất bại không tăng vỏ.
8. Thu một phần từng loại tại **Vỏ của đơn**: sổ khách giảm tương ứng, tổng vỏ bàn giao chuyến tăng tương ứng, không tạo tiền bán hàng hoặc hoàn cọc. Thử gửi lại cùng UUID, thu vượt mức, dùng tài xế khác và thu sau đối soát.
9. Đơn thất bại → kiểm hàng hoàn → giao lại trên assignment mới → SUCCESS: chỉ lần thành công ghi vỏ; lịch sử chuyến thất bại không thay đổi.
