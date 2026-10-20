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

## Giỏ hàng và danh sách trên điện thoại

- Giỏ có bình nước hiển thị “Chưa gồm tiền cọc vỏ” cạnh tạm tính, ở cả
  bước giỏ hàng và bước nhập thông tin giao. Mức cọc lấy từ chính sách hiện có;
  không cộng cọc vào tổng đơn hoặc thay đổi dữ liệu gửi đi.
- Dưới 768px, danh sách đơn hàng và khách hàng dùng thẻ, có sắp xếp,
  phân trang 10 mục, trạng thái đang tải và không có kết quả.
- Thẻ giữ các thao tác xem chi tiết, chuyển trạng thái đơn, mở hồ sơ và
  tạo đơn với thông tin khách đã điền. Nút chính cao 44px; chữ phụ từ 13px.
- Bản rút gọn của danh sách đơn trên tổng quan cũng dùng thẻ trên mobile.
  Desktop tiếp tục dùng bảng.

### Kiểm tra

1. Với màn hình 390px, vào Đơn hàng: chuyển trang, mở chi tiết, xác nhận
   đơn đang chờ, tìm từ khóa không tồn tại rồi xóa bộ lọc.
2. Vào Khách hàng: mở hồ sơ và tạo đơn từ cùng một thẻ; tên trong form
   phải đúng khách đã chọn. Thử sắp xếp và phân trang.
3. Thu về 320px: thẻ xuống dòng, các nút vẫn đọc và bấm được.
   Mở rộng lên 1440px: danh sách trở lại bảng.
4. Vào cửa hàng, thêm bình nước: nhắc cọc có ở cả giỏ và bước xác nhận.
   Đặt đơn demo, đối chiếu tổng với tiền hàng + phí giao.
5. Giỏ chỉ có nước đóng thùng không hiển thị nhắc cọc vỏ bình.

Đã chạy lint, build (bao gồm TypeScript), 8 nhóm `test:operations` và
8 nhóm `test:after-sales`. Chrome với profile tạm đã xác minh phân trang đơn,
chi tiết/chuyển trạng thái, tìm kiếm/rỗng/xóa lọc, hồ sơ khách, điền sẵn tên
khi tạo đơn, bảng desktop, thẻ 320px và đặt đơn demo giữ nguyên tổng tiền.
