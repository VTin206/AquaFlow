# Dashboard FE1

ADMIN mở trang Tổng quan `/` để xem kết quả kinh doanh. Dùng kỳ mặc định từ đầu tháng đến hôm nay hoặc chọn Hôm nay, 7 ngày, tháng này, khoảng ngày tùy chọn. Giới hạn 366 ngày, không chọn ngày tương lai; mốc hôm nay theo giờ Việt Nam.

- Tổng đơn: đơn tạo trong kỳ.
- Doanh thu: API báo cáo hiện tại, tiền hàng sau giảm giá/hàng trả, không gồm phí giao/cọc.
- AOV: doanh thu / đơn đã giao, không có đơn bằng 0.
- Đã giao/hủy: tính theo ngày giao/hủy trong kỳ.
- Khách mới: hồ sơ khách tạo trong kỳ, không tính nhóm vãng lai.
- Biểu đồ và top 10 khách/nhóm khách theo doanh thu cùng kỳ. Bấm tên khách mở hồ sơ trên `/customers?customerId=...`; nhóm vãng lai không có liên kết hồ sơ.

Dùng GET `/api/v1/admin/reports/summary` và `/api/v1/admin/reports/customers`. Không mở quyền API cho SALES_STAFF; nhân viên vẫn có phần vận hành đơn hàng/kho trên Dashboard. Không gọi API báo cáo hoặc hiển thị dữ liệu báo cáo đã cache cho nhân viên.

Loading không giả số 0; lỗi summary và bảng khách có nút thử lại độc lập. Kỳ rỗng vẫn hiển thị các số 0 hợp lệ cùng thông báo không có dữ liệu, kể cả khi API trả đầy đủ bucket ngày bằng 0. Đổi kỳ sử dụng query key mới, không giữ số liệu kỳ cũ trong lúc tải.

Demo dùng dữ liệu mẫu hiện có; khách mới của Demo tính theo lần mua đầu tiên (ghi rõ trên màn hình), khác nguồn ngày tạo hồ sơ của API thật.

Kiểm thử: chọn các kỳ, mở hồ sơ khách và đóng bằng nút đóng; kiểm tra ADMIN/SALES_STAFF, tắt API để kiểm tra lỗi/thử lại, chọn kỳ không có giao dịch. Chạy `npm run lint`, `npm run build`, `npm test` trong `frontend`.
