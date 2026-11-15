# Báo cáo – đề xuất API cho backend

Các báo cáo còn thiếu so với vận hành thực tế của đại lý nước. Frontend chưa làm giao diện cho các mục này; khi backend có API, frontend thêm tab hoặc khối tương ứng ở trang Báo cáo.

Phạm vi chung giống các báo cáo hiện có (`docs/REPORTS_API.md`): chỉ ADMIN, lọc theo `from`/`to` (giờ Việt Nam, tối đa 366 ngày), có phân trang `page`/`size` cho danh sách.

## 1. Công nợ khách hàng theo tuổi nợ

Dùng hằng ngày để biết khách nào cần nhắc thanh toán.

- Mỗi khách: tên, số điện thoại, tổng còn nợ, chia theo tuổi nợ `0–7`, `8–30`, `>30` ngày (tính từ ngày giao đơn), ngày nợ cũ nhất.
- Tổng cả cửa hàng theo từng nhóm tuổi nợ.
- Sắp xếp mặc định: nợ quá hạn lâu nhất trước.

## 2. Nhập hàng theo nhà cung cấp

Thay cho hai dòng "Phiếu nhập xác nhận" và "Giá trị hàng đạt nhập" đã bỏ khỏi Tổng quan.

- Mỗi nhà cung cấp: số phiếu nhập đã xác nhận, giá trị hàng đạt, số lượng hàng hỏng khi nhận, ngày nhập gần nhất.

## 3. Lý do hủy đơn và lý do giao thất bại

Hiện chỉ có số đơn hủy và số lần giao thất bại.

- Đếm theo lý do (nhóm lý do chuẩn hóa nếu có, còn lại gộp "Khác"), kèm tỷ lệ trên tổng.
- Lọc kênh/hình thức áp dụng như doanh thu.

## 4. Vỏ bình và tiền cọc theo khách

Hiện chỉ có tổng toàn cửa hàng.

- Mỗi khách: số vỏ đang giữ, tiền cọc đang giữ, cọc còn thiếu so với số vỏ, lần đổi vỏ gần nhất.
- Sắp xếp mặc định: thiếu cọc nhiều nhất trước.

## 5. Lãi gộp theo sản phẩm (để sau)

Cần thống nhất cách tính giá vốn trước (hiện chỉ có lãi gộp ước tính toàn kỳ theo giá nhập gần nhất, không phải giá vốn kế toán).
