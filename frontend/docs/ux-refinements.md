# Kiểm tra các cải tiến UX

## Phạm vi

- Tồn kho và lô hàng tách nhóm đã hết hạn khỏi nhóm sắp hết hạn. Ngày hết hạn
  hôm nay vẫn thuộc nhóm cảnh báo, giữ quy tắc ngày hiện có.
- Thống kê hết hạn chỉ đếm sản phẩm/lô còn tồn. Lô quá hạn không hiển thị
  “Xuất trước”; thay bằng nhãn đỏ “Không xuất”.
- Giá trị tồn vẫn là tổng số tồn × giá bán, không phải giá trị hàng được phép bán.
  Phép tính và các service nghiệp vụ không thay đổi.
- Tìm kiếm không dấu dùng chung cho danh mục, cửa hàng, kho, lô, đơn hàng,
  khách hàng và nhà cung cấp. Các trang có điện thoại hỗ trợ bỏ dấu phân cách
  và đối chiếu đầu số +84/0 khi nhập số đầy đủ.
- Bộ lọc đơn hàng lưu trong `sessionStorage` của tab. Khi trình duyệt chặn
  lưu trữ, bộ lọc vẫn hoạt động trên trang hiện tại. Từ khóa không đưa lên URL.
- Có số kết quả, nút xóa toàn bộ lọc và trở về trang kết quả đầu khi đổi bộ lọc.
- Form tạo đơn và nhập kho tự cuộn, focus vào trường không hợp lệ đầu tiên.

## Kiểm tra thủ công

1. Vào demo → Đơn hàng, tìm tên không dấu hoặc điện thoại không có khoảng trắng.
2. Chọn trạng thái/hình thức/thanh toán, sang Khách hàng rồi quay lại:
   từ khóa và lựa chọn phải được giữ. Tải lại trang cũng giữ bộ lọc.
3. Bấm “Xóa bộ lọc”: cả từ khóa và ba lựa chọn được đặt lại.
4. Vào Kho hàng, so sánh “Sắp hết hạn” với “Đã hết hạn”; các nhóm không trùng
   nhau. Làm tương tự ở tab Lô hàng. Lô quá hạn còn tồn hiển thị “Không xuất”.
5. Mở Tạo đơn/Tạo phiếu nhập, cuộn cuối form và xác nhận khi còn thiếu dữ liệu:
   trường lỗi đầu tiên phải được focus và nằm trong vùng nhìn thấy.

## Đã xác minh

- `npm run lint`, `npm run build`.
- `npm run test:ux`: 4 nhóm kịch bản cho tìm kiếm, điện thoại, ranh giới hạn
  dùng và dữ liệu bộ lọc đã lưu.
- `npm run test:operations`: 8 nhóm nghiệp vụ hiện có.
- Chrome với profile tạm và dữ liệu demo riêng: tìm kiếm, giữ/xóa bộ lọc,
  khôi phục sau reload, hai nhóm hạn dùng, scroll/focus trong hai form.
- Xem bố cục kho trên desktop 1440px và mobile 390px.

Không thay đổi backend hoặc database. Kiểm tra giao diện dùng dữ liệu demo,
không phải xác nhận nghiệp vụ với API thật.
