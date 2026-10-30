# Xuất báo cáo Excel

Trang Báo cáo dùng nút **Xuất Excel** thay cho CSV. Tên tệp:
`bao-cao-YYYY-MM-DD_YYYY-MM-DD.xlsx`, theo kỳ đang chọn.

## Nội dung

1. **Tổng quan**: doanh thu, đơn hàng, tiền thu/hoàn, giá vốn, lãi gộp,
   nhập hàng và chỉ số giao hàng.
2. **Theo ngày**: ngày, doanh thu, tiền thực thu, đơn tạo.
3. **Cọc và vỏ**: biến động thu/hoàn cọc, giao/thu/mất vỏ trong kỳ.
4. **Giao hàng**: kết quả theo tài xế.
5. **Nhập xuất tồn**: mã/tên/đơn vị sản phẩm, nhập đạt/hỏng, bán/trả,
   tồn hiện tại, doanh thu, giá vốn, lãi gộp.
6. **Kênh tiếp nhận**: số đơn tạo và doanh thu theo kênh.

Mỗi sheet ghi kỳ báo cáo, cố định bốn hàng đầu, có bộ lọc, độ rộng cột
và tiêu đề màu AquaFlow. Tiền/số lượng là số, ngày là ngày Excel,
mã sản phẩm lấy từ SKU trong danh mục, là văn bản để giữ số 0 đầu; để trống
nếu không còn tìm thấy sản phẩm trong danh mục. Tên bắt đầu bằng `=` vẫn là văn bản.
Giữ số âm và số 0; không thay đổi phép tính của service.

Tồn hiện tại là tồn lúc xuất, không phải tồn cuối kỳ. Cọc/vỏ là biến động,
không phải số dư; giá vốn/lãi gộp là ước tính. Các lưu ý này nằm trong tệp.
Không thêm CSV vào menu Báo cáo; các chức năng CSV khác không đổi.

## Triển khai và kiểm tra

- Dùng [ExcelJS](https://github.com/exceljs/exceljs) để tạo XLSX thật.
  Import động khi bấm xuất; gói xuất khoảng 259 kB gzip, không tải cùng
  trang Báo cáo. Build có cảnh báo kích thước chunk xuất Excel.
- Nút hiển thị đang xử lý và khóa bộ chọn kỳ trong lúc tạo tệp; lỗi tạo
  tệp có thông báo, sau đó mở lại điều khiển.
- `npm run test:report-excel`: ghi rồi đọc lại XLSX, kiểm tra kiểu số/ngày,
  tiếng Việt, kỳ báo cáo, số âm/0, mã có số 0 đầu, tên giống công thức,
  dữ liệu rỗng và dữ liệu nguồn không bị sửa.
- Lint và build (gồm TypeScript) đã qua.
- Chrome trên bản production, màn hình 320px, dữ liệu demo: bấm xuất bằng
  chuột, tải tệp vào thư mục tạm, đọc lại 6 sheet và đối chiếu tổng doanh thu
  với màn hình; xác minh thư viện chỉ được tải sau khi bấm nút.

Kiểm tra này dùng dữ liệu demo hiện có, không xác minh với API báo cáo thật.
