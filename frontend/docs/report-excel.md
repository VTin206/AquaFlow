# Xuất báo cáo Excel

Trang Báo cáo dùng nút **Xuất Excel** thay cho CSV. Tên tệp:
`bao-cao-YYYY-MM-DD_YYYY-MM-DD.xlsx`, theo kỳ đang chọn. Bộ lọc kênh và
hình thức nhận đang bật được ghi ở hàng 2 của mọi sheet.

## Nội dung

1. **Tổng quan**: tiền hàng, phí giao, hàng trả, doanh thu thuần, đơn hàng,
   tiền thu/hoàn, giá vốn, lãi gộp, nhập hàng, giao hàng và khách mua/khách mới.
2. **Theo ngày**: ngày, doanh thu thuần, tiền thực thu, đơn tạo.
3. **Cọc và vỏ**: biến động thu/hoàn cọc, giao/thu/mất vỏ trong kỳ và số dư
   vỏ/cọc khách đang giữ cuối kỳ.
4. **Giao hàng**: kết quả và đối soát tiền mặt theo tài xế.
5. **Bán hàng**: mã/tên/đơn vị sản phẩm, bán/trả, doanh thu, giá vốn, lãi gộp.
6. **Nhập xuất tồn**: tồn đầu kỳ, nhập NCC, khách trả nhập lại, xuất bán,
   tồn cuối kỳ, hỏng khi nhận, giá trị tồn cuối.
7. **Khách hàng** và **Khách lâu chưa đặt**.
8. **Kênh tiếp nhận**: số đơn tạo và doanh thu thuần theo kênh.

Mỗi sheet ghi kỳ báo cáo, cố định bốn hàng đầu, có bộ lọc, độ rộng cột
và tiêu đề màu AquaFlow. Tiền/số lượng là số, ngày là ngày Excel,
mã sản phẩm lấy từ SKU trong danh mục, là văn bản để giữ số 0 đầu; để trống
nếu không còn tìm thấy sản phẩm trong danh mục. Tên bắt đầu bằng `=` vẫn là văn bản.
Giữ số âm và số 0; không thay đổi phép tính của service.

Nhập xuất tồn, vỏ cọc và đối soát tài xế tính cho cả cửa hàng, không theo bộ
lọc; giá vốn/lãi gộp là ước tính. Các lưu ý này nằm trong tệp.
Không thêm CSV vào menu Báo cáo; các chức năng CSV khác không đổi.

## Triển khai và kiểm tra

- Dùng [ExcelJS](https://github.com/exceljs/exceljs) để tạo XLSX thật.
  Import động khi bấm xuất; gói xuất khoảng 259 kB gzip, không tải cùng
  trang Báo cáo. Build có cảnh báo kích thước chunk xuất Excel.
- Nút hiển thị đang xử lý và khóa bộ chọn kỳ trong lúc tạo tệp; lỗi tạo
  tệp có thông báo, sau đó mở lại điều khiển.
- `npx vitest run tests/report-excel.test.mjs`: ghi rồi đọc lại XLSX, kiểm tra kiểu số/ngày,
  tiếng Việt, kỳ báo cáo, số âm/0, mã có số 0 đầu, tên giống công thức,
  dữ liệu rỗng và dữ liệu nguồn không bị sửa.
- Lint và build (gồm TypeScript) đã qua.
- Chrome trên bản production, màn hình 320px, dữ liệu demo: bấm xuất bằng
  chuột, tải tệp vào thư mục tạm, đọc lại các sheet và đối chiếu tổng doanh thu
  với màn hình; xác minh thư viện chỉ được tải sau khi bấm nút.

Kiểm tra này dùng dữ liệu demo hiện có, không xác minh với API báo cáo thật.
