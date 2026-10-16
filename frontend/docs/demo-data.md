# Dữ liệu mẫu frontend

Cập nhật ngày 16/10/2026. Dữ liệu lưu trong bộ nhớ (`src/mocks/db.ts`), tải lại trang sẽ khôi phục bộ mẫu. Không ghi vào backend hoặc database.

- 25 đơn hàng: đủ 7 trạng thái, nhận tại quầy/giao tận nơi, chưa thanh toán/thanh toán một phần/đã trả đủ, có đơn thu qua nhiều phiếu.
- 18 khách hàng: cá nhân và tổ chức, số lần mua và vỏ đang giữ khác nhau; có khách mới chưa mua.
- 15 nhà cung cấp: thông tin hư cấu, có mẫu không điền các trường tùy chọn.
- 62 sản phẩm: giữ danh mục và ảnh hiện có, bổ sung tồn khả dụng và hạn dùng demo để kiểm tra cảnh báo. Tồn hiện tại là số có thể bán, sau phần đã giữ cho các đơn được xác nhận.
- 14 ngày doanh thu mẫu; ngày 16/10 khớp tổng các đơn mẫu đã hoàn tất lúc khởi tạo. Biểu đồ là dữ liệu tĩnh, không tự tính lại khi thao tác đơn trong phiên demo.

Một số đơn tiện kiểm tra:

| Mã đơn | Tình huống |
| --- | --- |
| AF-1064 | Đã giao, mới thanh toán một phần, còn phải thu |
| AF-1066 | Đã hoàn tất, thu 2 lần bằng chuyển khoản và tiền mặt |
| AF-1062 | Giao thất bại nhưng đã trả đủ, có thể giao lại |
| AF-1063 | Đã hủy, chưa thu tiền |
| AF-1067 | Chờ xác nhận, có sẵn tồn kho để thử xác nhận |

`demoScenarios.ts` bổ sung khách và tình huống đơn; `suppliers.ts` chứa nhà cung cấp; `data.ts` tập hợp bộ mẫu. Các đơn mới lấy tên, đơn vị và giá từ danh mục sản phẩm, tính tổng theo dòng hàng cộng phí giao hàng. Năm đơn mẫu ban đầu giữ giá lịch sử.
