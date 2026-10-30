# Task 4 và Task 5 — kết nối phần backend hiện có

Đối chiếu backend tại `develop` commit `956e097`. Không bổ sung endpoint hoặc đổi schema backend trong phần frontend này.

| Màn / nghiệp vụ | Dữ liệu thật | Phần đang chờ backend |
| --- | --- | --- |
| `/shop` | `GET /api/v1/products?active=true` | Tồn bán được, ảnh, dung tích, phí giao và chính sách cọc |
| `/shop/products/:id` | `GET /api/v1/products/{id}` | Nội dung chi tiết ngoài các trường ProductResponse |
| Giỏ hàng và `/checkout` | Sản phẩm/giá từ danh mục thật; giỏ lưu riêng trên trình duyệt | Gửi đơn công khai; nút gửi bị khóa, không tạo đơn giả |
| `/orders` của nhân viên | `GET /api/v1/sales/orders` và `GET /api/v1/sales/orders/{id}` | Tạo, xác nhận, hủy đơn; có form chuẩn bị và thao tác bị khóa |
| Form chuẩn bị đơn | Danh mục sản phẩm, `GET /api/v1/sales/customers`, `GET /api/v1/sales/customers/{id}/addresses` | Gửi đơn; có thể chọn hồ sơ và địa chỉ đã lưu để điền thông tin |
| `/inventory` của nhân viên | Danh mục sản phẩm thật | Tồn thực tế, đã giữ, khả dụng, lô và phiếu nhập |
| Form chuẩn bị phiếu nhập | `GET /api/v1/suppliers?active=true`, `GET /api/v1/products?active=true` | Lưu/xác nhận phiếu; nút xác nhận bị khóa |
| Sản phẩm → Loại vỏ bình | `GET /bottle-types`, `POST /bottle-types`, `PUT /bottle-types/{id}`, `DELETE /bottle-types/{id}` (đều dưới `/api/v1`) | Sửa chỉ cho đổi tiền cọc; chưa hỗ trợ đổi tên/kích hoạt lại |

## Bổ sung CRUD danh mục

- Trong trang **Sản phẩm**, nút **Loại vỏ bình** mở danh sách, tìm kiếm và tiền cọc.
  Admin được tạo, sửa tiền cọc và ngừng dùng; nhân viên chỉ xem loại đang dùng.
  Ngừng dùng là xóa mềm, có xác nhận. Admin lọc được đang dùng/đã ngừng dùng/tất cả.
- Sản phẩm và nhà cung cấp bổ sung tìm kiếm, làm mới, trạng thái và bộ lọc ngừng dùng
  dành cho Admin. Không tự thêm nút khôi phục vì API chưa hỗ trợ.
- Sau khi lưu/ngừng dùng danh mục hoặc thay đổi khách/địa chỉ, làm mới cache của
  trang kho, các form chọn dữ liệu và cửa hàng thật. Dữ liệu demo vẫn tách riêng.
- Tên loại vỏ đã ngừng dùng vẫn hiển thị khi xem sản phẩm đang tham chiếu nó;
  không cho chọn loại đã ngừng dùng cho sản phẩm mới.
- Đơn hàng dùng nghiệp vụ xác nhận/hủy; phiếu nhập đã ghi nhận cần nghiệp vụ điều chỉnh.
  Không bổ sung xóa tự do cho đơn, lô hoặc số tồn.

## Phân biệt dữ liệu

- Khách không cần đăng nhập để xem danh mục, chi tiết, giỏ và Checkout.
- `active=true` chỉ chứng minh sản phẩm đang kinh doanh. Không suy ra còn hàng,
  không đặt tồn bằng 0 và không dùng dữ liệu demo thay khi request thật thất bại.
- Giỏ thật và giỏ dùng thử có khóa lưu trữ khác nhau. Sản phẩm đã biến mất khỏi
  danh mục vẫn hiện trong giỏ để khách bỏ; không âm thầm loại khỏi đơn dự kiến.
- Tài khoản dùng thử vẫn có luồng đặt đơn → mã đơn → chờ xác nhận, cũng như
  các thao tác đơn/nhập kho/lô có sẵn. Có nhãn dữ liệu mẫu; không ghi PostgreSQL.
- Tra cứu công khai ở phiên thật chưa khả dụng. Không dùng API đơn hàng nội bộ
  yêu cầu quyền nhân viên để tra cứu cho khách.
- Nhân viên xem đúng trạng thái `CONFIRMED`, `PREPARING` và trạng thái thanh toán
  backend trả về; tiền hàng/giảm giá/phí giao/tổng lấy từ OrderResponse.
- Form chuẩn bị chỉ kiểm tra thông tin, không lưu bản nháp và không gửi mutation.
  Quy tắc/request ghi sẽ cần đối chiếu contract BE2/BE3 khi endpoint được cung cấp.

## Các API cần nhóm backend bổ sung/chốt

1. Đặt đơn công khai, trả mã đơn/trạng thái và cơ chế tra cứu phù hợp cho khách.
2. Tạo, xác nhận và hủy đơn của nhân viên; kiểm tồn/giữ hàng và quyền ở backend.
3. Tổng hợp tồn theo sản phẩm/lô: tồn thực tế, đã giữ, khả dụng, đơn vị và hạn dùng.
4. Danh sách/chi tiết/tạo/xác nhận phiếu nhập, cùng quy tắc mã lô và hạn sử dụng.
5. Số liệu trong ngày cho trang Tổng quan: doanh thu thuần, tiền đã thu, tổng còn phải thu (theo số tiền, không chỉ trạng thái thanh toán). Hiện tài khoản thật chỉ hiện số đơn tạo hôm nay và đếm đơn chưa thu đủ theo `paymentStatus`.
6. Trạng thái giao thất bại: BE chưa có nên mục "Giao thất bại" trong Việc cần làm chỉ có ở bản dùng thử.
7. Mã đơn ngắn, đọc được qua điện thoại: hiện BE sinh `AF-` + 20 ký tự UUID (23 ký tự), quá dài cho bảng, phiếu in và khi khách đọc mã tra cứu. Đề xuất `AF-YYMMDD-NNN` (số thứ tự trong ngày, ví dụ `AF-261030-012`) hoặc `AF-` + số tăng dần; link tra cứu đã có `trackingToken` riêng nên mã đơn không cần khó đoán.
8. Bật lại bản ghi đã ngừng: hiện chỉ có `DELETE /suppliers/{id}`, `DELETE /bottle-types/{id}`, `DELETE /sales/customers/{id}` (ngừng), không có chiều ngược lại và `SupplierRequest` không có `active`. Cần `PATCH .../{id}/activate` cho nhà cung cấp, loại vỏ, khách hàng (hoặc nhận `active` trong PUT), và `GET /sales/customers?active=false` để xem khách đã lưu trữ. Có API thì bật cờ `reactivate` trong `src/shared/features.ts`.

Không dự đoán URL hoặc tự gửi request vào endpoint chưa có.

## Kiểm thử

- `npm test` bao gồm `test:live-api`: dùng HTTP server fixture theo DTO hiện tại,
  kiểm đường dẫn/query, mapping SKU/giá, tồn chưa biết, dữ liệu đơn và lỗi 403/404.
  Bổ sung kiểm tạo loại vỏ, update chỉ gửi tiền cọc, lỗi trùng tên 409,
  xóa mềm 204, bộ lọc và làm mới cache giữa các màn.
- Chrome với HTTP fixture cho CRUD loại vỏ: validation, giữ form khi API lỗi,
  tạo/sửa/ngừng dùng, tìm kiếm/lọc, thử lại, giao diện 390px và nhân viên chỉ xem.
- Chrome với phản hồi API fixture: xem sản phẩm/chi tiết, giỏ giữ qua reload,
  Checkout và validation, lỗi danh mục/thử lại, xem đơn/chi tiết, form phiếu nhập,
  không gửi mutation chưa hỗ trợ, giỏ demo tách biệt và đặt đơn demo thành công.
- Kiểm bố cục Checkout và form phiếu nhập ở 390px.
- Backend local không chạy ở `localhost:8080` trong lần kiểm tra này. Các kiểm thử
  HTTP fixture không thay thế việc chạy toàn bộ stack với PostgreSQL thật.
