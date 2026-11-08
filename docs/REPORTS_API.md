# Báo cáo RESTful

ADMIN only; 401 chưa đăng nhập, 403 role khác. Chỉ GET, không tạo/sửa/xóa số liệu báo cáo.

| Resource | Nội dung |
| --- | --- |
| `/api/v1/admin/reports/summary` | Tổng hợp doanh thu, thanh toán, từng ngày/kênh, nhập hàng và sổ cọc |
| `/api/v1/admin/reports/products` | Số lượng đã giao/trả và tiền hàng theo sản phẩm |
| `/api/v1/admin/reports/inventory` | Nhập–xuất–tồn theo sản phẩm, bao gồm sản phẩm ngừng hoạt động |
| `/api/v1/admin/reports/delivery` | Từng lần giao, trễ hẹn và đối soát tài xế |
| `/api/v1/admin/reports/customers` | Đơn giao và doanh thu theo hồ sơ khách; khách không gắn hồ sơ gộp một nhóm |

Tham số bắt buộc `from`, `to`: YYYY-MM-DD, bao gồm hai ngày, tối đa 366 ngày, không quá hôm nay. Chuyển thành khoảng UTC `[00:00 from,00:00 ngày sau to)` theo Asia/Ho_Chi_Minh. Optional `channel=WEB|COUNTER|PHONE|MESSAGE`, `method=COUNTER|DELIVERY`. Các bảng nhận `page` 0–100000, `size` 1–100 (mặc định 20), trả `{content,page,size,totalElements}`. Bộ lọc không hợp lệ/missing trả 400. Kỳ rỗng có tổng 0 và đủ bucket ngày, bảng rỗng.

Mỗi request đọc một snapshot REPEATABLE_READ. Summary có timezone và generatedAt. Các resource gọi độc lập có thể phản ánh snapshot khác nhau khi có thao tác mới; dùng Làm mới để lấy lại.

## Định nghĩa số liệu

- Đơn tạo theo created_at; đơn hủy theo cancelled_at trong kỳ, không giới hạn ở đơn tạo cùng kỳ.
- Doanh thu: chỉ DELIVERED/COMPLETED theo delivered_at. Đơn COUNTER cũ thiếu delivered_at lấy thời điểm phiếu xuất (đã giao tại quầy). Đơn đã giao thiếu cả thời điểm cần thiết không được gán ngày giả; summary trả undatedDeliveredOrders để cảnh báo.
- Doanh thu = subtotal − discount_amount + delivery_fee − giá trị hàng khách trả trong kỳ. Hàng trả từ order_returns phân bổ giảm giá của đơn theo tỷ lệ subtotal; ghi giảm đúng kỳ trả, kể cả đơn giao kỳ trước. Hoàn kho giao thất bại (inventory_returns) không trừ doanh thu vì đơn chưa được ghi nhận bán.
- Tiền hàng theo sản phẩm dùng line_total, phân bổ giảm giá theo tỷ lệ của đơn, không gồm phí giao. Số sold là số lượng giao, returned riêng. Tổng tiền hàng có thể chênh vài xu với subtotal khi phân bổ giảm giá và làm tròn từng dòng sản phẩm.
- Thanh toán chỉ CONFIRMED theo confirmed_at, IN dương/OUT âm. Tiền mặt và chuyển khoản là thu IN, refunds là OUT. Đây là toàn bộ tiền thanh toán đã lưu (có thể gồm cọc nếu khoản thanh toán gộp), không phải doanh thu. Không cộng thêm handover_records hoặc suy thu tiền từ payment_status.
- Kho tính lùi từ inventory_balances: tồn cuối = tồn hiện tại − biến động từ cuối kỳ trở đi; tồn đầu = tồn cuối − biến động trong kỳ. RECEIVE/RETURN/ADJUST_UP cộng, DISPATCH/COUNTER_SALE/ADJUST_DOWN trừ. Điều chỉnh hiện riêng; hàng loại khi nhận/hoàn không trừ tồn lần hai. Độ đầy đủ lịch sử phụ thuộc tồn và sổ kho đã lưu; không phải snapshot khóa sổ kế toán.
- Nhập NCC chỉ phiếu CONFIRMED theo confirmed_at: giá trị hàng đạt = quantity_accepted × unit_cost; hàng loại = quantity_received − quantity_accepted.
- Giao hàng đếm từng attempt trong kỳ, không đếm đơn duy nhất. Late là SUCCESS sau requested_delivery_at. Đối soát theo handed_over_at, cashReported − cashConfirmed là chênh lệch báo/nộp, không phải tiền khách phải trả.
- Cọc và vỏ đọc sổ deposit_transactions / bottle_transactions đến hết kỳ; không suy từ số đơn hay từ lượng hàng giao.
- Kho, nhập hàng, cọc/vỏ và đối soát luôn toàn cửa hàng. Bộ lọc kênh/hình thức áp dụng vào các số liệu theo đơn và delivery attempts.
- Chưa tính giá vốn, lãi gộp, giá trị tồn theo giá vốn, khách mới/khách lâu không mua do chưa có chính sách giá vốn chốt và lịch sử đủ tin cậy. FE không dùng công thức giá bán × 70% của dữ liệu mẫu.

## FE và Excel

Tài khoản thật dùng LiveReportsPage, demo giữ trang mẫu. Tổng quan có biểu đồ và so sánh doanh thu kỳ trước cùng số ngày. Các bảng phân trang ở BE. Excel tổng quan xuất toàn bộ bucket ngày; Excel tab bảng xuất **trang hiện tại**, ghi rõ phạm vi và bộ lọc. Ô số giữ numeric, chuỗi lưu dạng text. Trang Tổng quan dashboard cũ vẫn giữ cờ revenueReports vì hook đó chưa chuyển sang báo cáo thật; việc mở trang /reports độc lập với cờ dashboard.

V14 thêm index theo thời gian, không thay đổi giao dịch cũ. Kiểm thử PostgreSQL bao gồm biên giờ Việt Nam, discount, hàng trả kỳ trước, fallback đơn tại quầy, loại thanh toán pending, không cộng trùng handover, tồn lùi/điều chỉnh, quyền và phân trang.
