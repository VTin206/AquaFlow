# Báo cáo giao hàng và tồn kho Sprint 4

Chỉ bổ sung báo cáo thật (`/reports?tab=delivery`, `/reports?tab=inventory`), không sửa Demo.

## Giao hàng

GET `/api/v1/admin/reports/delivery` thêm `redelivered`: số lần giao thứ hai trở đi của cùng đơn, xếp theo `attempted_at`, rồi ID. Xếp thứ tự trên toàn bộ lịch sử trước khi lọc kỳ; không dùng riêng `attempt_no` vì số này có thể bắt đầu lại trên assignment mới. Mỗi lần giao được tính cho tài xế của chuyến tương ứng. Giao lại bao gồm cả thành công và thất bại.

Các cột thành công/thất bại/trễ vẫn đếm **lần giao**, không phải số đơn duy nhất. Giao trễ chỉ tính lần thành công sau giờ hẹn. Lọc kênh/hình thức áp dụng cho các lần giao; đối soát vẫn tính toàn cửa hàng như contract cũ.

## Tồn kho

GET `/api/v1/admin/reports/inventory` thêm:

- `latestUnitCost`: giá từ dòng hàng đạt (`quantity_accepted > 0`) của phiếu CONFIRMED gần nhất có `confirmed_at` trước cuối kỳ. Nếu cùng thời gian, ưu tiên ID phiếu rồi ID dòng lớn hơn. Không lấy phiếu nháp/hủy, dòng loại toàn bộ hoặc giá phát sinh sau kỳ.
- `closingValue`: tồn cuối × giá trên. Tồn bằng 0 trả 0; tồn khác 0 nhưng chưa có giá trả null và FE hiện “Chưa có giá nhập”. Không thay bằng giá bán hoặc 0đ.

Đây là định giá vận hành theo giá nhập gần nhất, không phải COGS/giá vốn kế toán. Hiển thị từng sản phẩm; Excel chỉ xuất trang đang xem, giữ null là ô trống và có chú giải. Không cộng giá trị một trang thành tổng cả kho.

Các cột nhập/xuất/hoàn/tồn và điều chỉnh từ lịch sử được giữ nguyên. Không thêm API hoặc form chỉnh kho, COGS, lợi nhuận hay Category. Không đổi schema/Flyway.

## Kiểm tra

Backend: PostgreSQL integration tests đối chiếu fixture DB với giá trị API, giá theo thời điểm cuối kỳ, giá thiếu, giao lại qua assignment khác và ngoài kỳ, mốc 00:00 giờ Việt Nam/end-exclusive, ADMIN/401/403, lọc ngày và kỳ rỗng.

Frontend: báo cáo thật có loading/error/retry/empty; hai tab hiển thị cột mới, giữ giá thiếu khác 0, gửi đúng kỳ lọc, chặn kỳ >366 ngày/tương lai, không gọi API khi không phải ADMIN. Ngày mặc định và giới hạn hôm nay theo Asia/Ho_Chi_Minh.
