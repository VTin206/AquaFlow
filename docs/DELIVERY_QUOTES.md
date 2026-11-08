# Phí giao trước khi đặt hàng

Checkout thật gọi `POST /api/v1/delivery-quotes` (không cần đăng nhập):

```json
{"items":[{"productId":1,"quantity":2}],"stairFloor":2}
```

API trả `subtotal`, `baseFee`, `stairsFee`, `deliveryFee`, `total`. Giá sản phẩm lấy từ DB; sản phẩm ngừng bán bị từ chối. Báo phí không giữ hàng.

Chính sách áp dụng giống Demo theo yêu cầu cửa hàng:

- Dưới 3 sản phẩm: phí cơ bản 15.000đ; từ 3 sản phẩm miễn phí cơ bản.
- Bình nước (đơn vị `Bình` hoặc `binh`, không phân biệt hoa thường): thang bộ tầng 1–2 là 2.000đ/bình/tầng; tầng 3 là 8.000đ/bình; từ tầng 4 là 12.000đ/bình.
- `stairFloor` từ 0 đến 30; 0 là tầng trệt hoặc có thang máy. Không tính khoảng cách/khu vực. Miễn phí cơ bản không miễn phụ thu thang bộ.
- Tổng này chưa gồm cọc vỏ; checkout giải thích tiền cọc riêng.

Tạo đơn khách vãng lai hoặc CUSTOMER gửi thêm `stairFloor` và `expectedTotal`. Backend tính lại bằng cùng công thức, lưu `delivery_fee`, ghi số tầng trong ghi chú đơn để nhân viên xem. Nếu tổng tiền khác báo giá, trả HTTP 409 trước khi lưu; checkout tải lại báo phí để khách kiểm tra và đặt lại. Client cũ không gửi `expectedTotal` vẫn dùng phí do BE tính, tầng mặc định 0.

Chỉ áp dụng cho đơn WEB/DELIVERY mới. Không sửa phí của đơn cũ hoặc đơn do nhân viên tạo. Không cần migration mới.

Kiểm tra tại `/shop`: thêm 2 bình, mở checkout: phí 15.000đ; nhập 2 tầng: 23.000đ. Thêm bình thứ ba: phí cơ bản 0, phụ thu 12.000đ. Tắt API: hiển thị lỗi/thử lại, không cho đặt đến khi có báo phí hợp lệ.
