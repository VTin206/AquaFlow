# Kiểm nhận hàng hoàn tại kho

Quyền: ADMIN và SALES_STAFF. API yêu cầu Bearer token.

| Method | Resource | Kết quả |
| --- | --- | --- |
| GET | `/api/v1/inventory/returns/pending` | Đơn chờ kiểm, kèm từng lô hàng của chuyến gần nhất đã thực sự chở hàng |
| POST | `/api/v1/inventory/returns` | Tạo phiếu kiểm bất biến, HTTP 201 và Location |
| GET | `/api/v1/inventory/returns?page=0&size=20` | Danh sách phiếu mới nhất; size 1–100 |
| GET | `/api/v1/inventory/returns/{id}` | Chi tiết phiếu, hoặc 404 |

Ví dụ POST:

```json
{
  "orderId": 42,
  "lines": [{ "loadItemId": 12, "sellable": 3 }],
  "note": "Một bình nứt, loại bỏ"
}
```

`loadItemId` lấy từ pending; phải gửi đủ từng dòng một lần. `sellable` là số nguyên từ 0 đến số hàng mang về. Phần còn lại là hàng loại bỏ, bắt buộc ghi chú tối đa 300 ký tự. Lô hết hạn theo ngày Việt Nam chỉ nhận sellable=0.

Điều kiện: đơn DELIVERY đang OUT_FOR_DELIVERY, chuyến gần nhất đã chở hàng phải COMPLETED với kết quả FAILED; không có chuyến nào đang giữ đơn. Chuyến mới bị hủy trước khi xuất phát không che mất hàng hoàn từ chuyến trước.

Trong một transaction: khóa đơn (cùng khóa với phân đơn lên chuyến), lưu phiếu và từng lô, tăng tồn đúng lô của phần sellable và version của balance, ghi RETURN liên kết ORDER, ghi nhận toàn bộ quantity_returned trên manifest, rồi chuyển đơn sang CANCELLED. Phần hỏng không cộng tồn và không trừ tồn lần nữa. Phiếu có UNIQUE order_id và load_item_id, gửi lại trả 409 thay vì cộng tồn lần hai.

Đây là nhận hoàn **toàn bộ đơn giao thất bại**, chưa hỗ trợ hoàn một phần đơn đã giao, tự hoàn tiền hay sổ cọc/vỏ. Giao diện ghi rõ thao tác sẽ hủy đơn. Muốn giao lại sau kiểm nhận, tạo đơn mới để giữ và xuất hàng mới; chưa kiểm nhận thì vẫn có thể chuyển hàng đang ngoài kho sang chuyến khác như trước.

Kiểm tra thủ công: xuất kho đơn → tạo chuyến → bắt đầu → ghi FAILED → kết thúc/đối soát chuyến → Kho hàng / Hàng hoàn / Chờ kiểm → nhập số bán lại và ghi chú → xác nhận → xem tab Đã kiểm và Xuất / nhập kho (RETURN).

Migration V12 tạo riêng inventory_returns và inventory_return_lines, không thay đổi lịch sử order_returns cũ.
