# Danh mục nước tham khảo iWater

Cập nhật: 16/10/2026. Phạm vi: frontend và dữ liệu mẫu AquaFlow.

## Đã triển khai

- 61 sản phẩm nước có ảnh, thuộc 12 nhóm thương hiệu đang có sản phẩm tại các trang đã kiểm tra; cộng 1 mã vỏ bình luân chuyển.
- Xóa 3 sản phẩm mang thương hiệu AquaFlow (`P-001`, `P-003`, `P-005`), bỏ bộ lọc thương hiệu AquaFlow. Tên và logo ứng dụng vẫn giữ nguyên.
- Đơn mẫu tham chiếu Vihawa 20L và Aquafina 500ml thay cho các mã đã xóa. Giá lịch sử của đơn giữ nguyên.
- `data.ts` bổ sung tồn khả dụng và hạn dùng minh họa cho danh mục: có hàng, tồn thấp, hết hàng và gần hết hạn. Vỏ bình giữ tồn kho cũ. Giá, tồn và hạn dùng đều là dữ liệu demo, không phải số liệu từ iWater và không đồng bộ trực tuyến.
- Form thêm sản phẩm không tự gán thương hiệu AquaFlow khi để trống.

## Thương hiệu và mức độ đầy đủ

| Nhóm thương hiệu | Số sản phẩm nước |
| --- | ---: |
| LaVie, gồm dòng ViVa | 15 |
| Vĩnh Hảo, gồm dòng Vihawa | 9 |
| Aquafina | 5 |
| ion Life | 6 |
| Satori | 5 |
| Bidrico | 4 |
| Rosée | 4 |
| TH true Water | 3 |
| Dasani | 3 |
| Pocari Sweat | 4 |
| Revive (Pepsi) | 2 |
| Lemont | 1 |

Các con số là kết quả kiểm tra các trang thương hiệu, không phải cam kết bao phủ toàn bộ website. Không đưa bột pha Pocari 13g vào danh mục nước đóng chai/lon.

Menu [iWater](https://iwater.vn/) vẫn liệt kê năm thương hiệu bên dưới, nhưng chưa tìm được sản phẩm/ảnh tương ứng ở các trang đã kiểm tra. Chúng có mặt trong bộ lọc với số lượng 0 và trạng thái trống rõ ràng, không dùng sản phẩm thương hiệu khác để lấp vào.

| Thương hiệu | Trang nguồn | Kết quả kiểm tra |
| --- | --- | --- |
| Sapuwa | https://iwater.vn/sapuwa/nuoc-tinh-khiet | Hiển thị nội dung trang chủ |
| Wami | https://iwater.vn/wami/nuoc-tinh-khiet | Hiển thị nội dung trang chủ |
| 333 | https://iwater.vn/333-water/nuoc-tinh-khiet | Hiển thị nội dung trang chủ |
| Đảnh Thạch | https://iwater.vn/danh-thach/nuoc-khoang | Hiển thị nội dung trang chủ |
| Thạch Bích | https://iwater.vn/thach-bich/nuoc-khoang | Có tên thương hiệu, không có sản phẩm |

## Phân loại giao diện

- Loại nước: tinh khiết, nước khoáng, ion kiềm, hoàn lưu khoáng, nước có ga, bù khoáng & điện giải. Vỏ bình/phụ kiện là nhóm riêng.
- Quy cách: bình vòi, bình úp máy, thùng chai, thùng chai thủy tinh, thùng lon, lốc chai.
- Dung tích: 250–355ml, 390–520ml, 750–900ml, 1–1,5L, 4,5–5L, 18,5–20L. Đây là nhóm lọc của AquaFlow; thẻ sản phẩm hiển thị dung tích cụ thể.
- Một số trang nguồn có thông số không khớp tiêu đề (ví dụ Bidrico 500ml, Dasani 350ml/1,5L). Dữ liệu minh họa lấy dung tích theo tên sản phẩm và URL; không sao chép máy móc các dòng thông số mâu thuẫn.
- Tìm kiếm không dấu, bộ chọn thương hiệu có tìm kiếm, kết hợp bộ lọc, xóa bộ lọc, phân trang 12/24/48 sản phẩm.

## Tệp và ảnh

- `src/mocks/waterCatalog.ts`: danh sách 61 sản phẩm, ảnh và thông tin phân loại tương ứng.
- `src/mocks/data.ts`: tập hợp danh mục nước với vỏ bình, cùng dữ liệu đơn mẫu.
- `src/features/inventory/catalog.ts`: nhóm thương hiệu và bộ lọc; sản phẩm tự thêm chưa có metadata hiển thị "Chưa phân loại".
- `public/images/reference/iwater/`: 8 ảnh ban đầu và trang xem trước bộ ảnh ban đầu.
- `public/images/products/iwater/`: 53 ảnh bổ sung; `sources.json` ghi nguồn của cả 61 ảnh nước trong danh mục.
- `public/images/brands/`: 9 logo nguồn iWater, kèm `sources.json`. Các nhóm chưa có logo dùng ảnh sản phẩm đại diện hoặc biểu tượng giữ chỗ, không tạo logo giả.

Ảnh được giữ nguyên nhãn và tỷ lệ (`object-fit: contain`). Nguồn chưa xác nhận giấy phép tái sử dụng thương mại. Không thay đổi backend hay API; fixture kiểm thử đơn hàng được tách khỏi danh mục minh họa để việc bổ sung thương hiệu không làm lệch các kịch bản kiểm thử.
