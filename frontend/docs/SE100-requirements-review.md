# Đối chiếu AquaFlow với báo cáo SE100

Ngày rà soát: 16/10/2026.

Nguồn: `SE100 - PPPTPMHĐT_final.docx`, do người dùng cung cấp. Tên tệp có chữ “final”, nhưng trang bìa ghi **Báo cáo tiến độ lần 1**. Các nhận xét dưới đây dựa trên nội dung văn bản và bảng trong tài liệu, không coi tên tệp là xác nhận yêu cầu đã được nghiệm thu. Không sửa bản Word gốc.

## 1. Kết luận đối chiếu

AquaFlow hiện là **bản giao diện quản trị có dữ liệu mô phỏng**, chưa phải hệ thống hoàn chỉnh theo báo cáo. Phần giao diện đã có Tổng quan, Đơn hàng, Kho, Sản phẩm, Khách hàng, Giao hàng và Báo cáo. Các service nghiệp vụ frontend đọc/ghi `src/mocks/db.ts`; dữ liệu mất khi tải lại trang. Backend có health check, endpoint báo trạng thái auth chưa triển khai, cấu hình Spring và migration khởi tạo. Chưa thấy API nghiệp vụ hoàn chỉnh trong các module inventory/customer/delivery.

Phạm vi đúng theo mục II và VII: **một cửa hàng, một kho**. Không cần chọn chi nhánh, điều chuyển liên kho hoặc báo cáo chuỗi. Nhà cung cấp là đối tượng được cửa hàng quản lý, không phải vai trò đăng nhập (mục 4.2).

Đợt này hoàn thành việc rà soát và chỉnh luồng giao diện đơn hàng/giao nhận trọng tâm. Những khoảng thiếu trong ma trận vẫn là công việc cần xây tiếp; không coi mock, bảng database hoặc nút có trên giao diện là tính năng production đã hoàn thành.

## 2. Ma trận yêu cầu và hiện trạng sau điều chỉnh

| Nhóm | Căn cứ trong Word | Hiện trạng | Phần còn thiếu |
|---|---|---|---|
| Phạm vi cửa hàng | II, VII | Khung giao diện ghi một cửa hàng/một kho | Thông tin cấu hình cửa hàng thực tế |
| Đăng ký, đăng nhập, nhóm quyền | 3.3, 4.2, 4.5, 6.5 | Chưa có xác thực; tên tài khoản trên thanh trên cùng là minh họa | Login, JWT/session, vai trò chủ cửa hàng/bán hàng/giao hàng/khách, kiểm tra quyền tại API |
| Website dành cho khách | 5.1, 5.3 | Chưa có; trang Sản phẩm hiện là màn hình nội bộ | Danh mục công khai, giỏ hàng, đặt không tài khoản, liên kết tra cứu riêng, tài khoản và địa chỉ tự nguyện |
| Sản phẩm | 4.5, 6.4, 6.10 | Xem, tìm, tạo sản phẩm mock | Cập nhật, ngừng kinh doanh, quy cách thùng, loại vỏ, giá cọc, liên kết nhà cung cấp; không xóa sản phẩm có giao dịch |
| Khách hàng | 4.5, 5.3, 6.1 | Danh sách mẫu; tạo đơn từ khách có sẵn tự điền tên/điện thoại | CRUD hồ sơ, mã định danh, nhiều địa chỉ, lịch sử đơn và sổ vỏ thực; đơn giao hiện chỉ lưu bản chụp liên hệ, chưa gắn FK hồ sơ |
| Nhà cung cấp | 4.2, 4.5, 5.2 | Có bảng SQL ban đầu; chưa có UI/API | Hồ sơ, sản phẩm cung ứng, lịch sử nhập, trao đổi vỏ/cọc và đối soát |
| Phiếu nhập, lô, giá vốn | 5.2, 6.1–6.3 | Modal nhập tăng số lượng mock của một sản phẩm | Phiếu nhiều dòng, nhà cung cấp, ngày nhận, người nhận, mã lô, NSX/HSD, giá vốn, kiểm nhận, hàng thiếu/hỏng |
| Tồn kho | 3.3, 5.4, 6.2 | Hiển thị và tìm tồn; mock giữ hàng khi xác nhận, giải phóng khi hủy trước xuất giao | Tách tồn vật lý/giữ hàng/khả dụng/hàng đang giao, tồn theo lô, FEFO, phiếu xuất/hoàn/điều chỉnh, transaction và khóa đồng thời ở backend |
| Hạn sử dụng | 6.3, 6.9 | Cảnh báo theo trường HSD của sản phẩm; chặn sản phẩm đã hết hạn trong mock đặt/xử lý đơn | HSD đúng theo từng lô, kiểm tra NSX/HSD/ngày nhận, truy xuất lô và xuất lô gần hết hạn trước |
| Tiếp nhận đơn | 4.5, 5.3–5.4, 6.1 | Đã bổ sung nhiều sản phẩm, kênh tiếp nhận, tại quầy/giao tận nơi, tên/điện thoại/địa chỉ, giờ hẹn, phí giao, ghi chú | Website đặt hàng, liên kết khách, vùng giao/phí tự động, chỉnh đơn trước xuất, giữ vỏ/cọc và giảm giá có quyền |
| Giá và giữ hàng | 5.4, 6.2, 6.5 | Mock kiểm tra lại tồn, chốt đơn giá từng dòng khi xác nhận; thay giá sản phẩm sau đó không sửa đơn đã chốt | Lịch sử bảng giá, chính sách giảm giá, xác nhận khách khi đổi giá, transaction đa người dùng |
| Chi tiết và hủy đơn | 5.4, 6.9 | Hộp thoại có dòng hàng, giao nhận, số tiền và lịch sử; hủy có lý do trước xuất, giải phóng giữ hàng | Hủy sau xuất giao, hàng hoàn, hoàn tiền; hiện chặn hủy trực tiếp nếu đã thu tiền |
| Chuyến giao và phân công | 4.5, 5.4–5.5, 6.1 | Chưa có chuyến; bảng hiện theo dõi đơn lẻ | Tạo chuyến nhiều đơn, chọn tài xế, giờ đi/về, ngăn một đơn ở hai chuyến, bàn giao người thay thế |
| Kết quả từng lần giao | 5.5, 6.6 | Mock lưu người nhận hoặc lý do thất bại và cho giao lại; tại quầy bỏ qua bước đang giao | Thực thể lần giao, số lượng thực giao/hoàn, vỏ, tài xế, người nhận hộ đầy đủ, phát hiện giao trễ và bằng chứng giao |
| Thanh toán | 5.6, 6.5 | Đã có phiếu thu mock theo đơn, nhiều lần thu, tiền mặt/chuyển khoản, tham chiếu, số còn phải thu; tách khỏi giao nhận | API phiếu thu, người xác nhận, hoàn tiền, đối soát tiền tài xế, chứng từ, concurrency/idempotency bền vững |
| QR chuyển khoản | 4.5, 5.6 | Chưa sinh QR; chuyển khoản hiện được ghi nhận thủ công sau kiểm tra | Cấu hình tài khoản nhận, yêu cầu QR theo đơn, hạn/trạng thái; webhook chỉ khi chọn tích hợp xác minh giao dịch |
| Vỏ bình và cọc | 4.4–4.5, 5.5–5.6, 6.7 | Chỉ có số vỏ giữ mẫu trên khách và sản phẩm vỏ; không có sổ cọc | Loại vỏ, giao/thu/vỡ/mất, bên giữ, số dư từ lịch sử, thu/hoàn cọc, điều chỉnh được duyệt; cọc phải tách doanh thu |
| Sự cố và nhật ký | 3.3, 4.4, 6.9 | Timeline đơn mock lưu tạo/xác nhận/giao/thu/hủy, chưa có danh tính người thao tác | Phiếu sự cố, quyền xử lý, trước/sau, người thực hiện, audit bất biến phía server, hoàn/đổi và trách nhiệm sai lệch |
| Báo cáo | 5.7 | Biểu đồ doanh thu theo mảng mẫu độc lập; giá trị tồn theo giá bán | Chọn kỳ, doanh thu từ giao dịch, nhập–xuất–tồn theo lô/NCC, tiền thu/hoàn, giao/chuyến/thất bại/trễ, vỏ/cọc, giá vốn/lợi nhuận, xuất tệp |

## 3. Các điểm lệch đã sửa trong giao diện và mô phỏng

1. Form đơn trước chỉ nhận tên và một sản phẩm; số điện thoại, địa chỉ bị thay bằng câu “chưa cập nhật”. Nay có thông tin nhận hàng thật từ form, nhiều dòng hàng, kênh, lịch hẹn và phí giao. Đơn quầy mua chai/thùng cho phép khách vãng lai; giao tận nơi hoặc mua bình cần tên/điện thoại.
2. Trước đây tạo yêu cầu là trừ tồn. Nay tạo yêu cầu chưa giữ hàng; xác nhận mới kiểm tra toàn bộ dòng, gộp số lượng sản phẩm trùng, chốt giá và giữ hàng. Lỗi ở một dòng không được trừ dở dang các dòng khác.
3. Trước mọi đơn đi qua “Đang giao”, kể cả tại quầy. Nay đơn quầy xác nhận → chuẩn bị → khách nhận; đơn giao có kết quả thành công/thất bại và lý do giao lại.
4. Trước nút “Hoàn tất” lúc giao ngầm kết thúc toàn bộ đơn. Nay xác nhận nhận hàng không xác nhận thanh toán. Đơn hoàn tất khi vừa nhận hàng vừa thu đủ tiền.
5. Trước không có chi tiết tiền thu. Nay mã đơn mở hộp thoại có giá từng dòng, tổng/đã thu/còn thu, phiếu thu, tham chiếu chuyển khoản và lịch sử thao tác.
6. Bổ sung hủy đơn chưa xuất giao, bắt buộc lý do, trả lại hàng đang giữ. Đơn đã thu tiền cần quy trình hoàn tiền; không giả lập hoàn tiền bằng cách xóa phiếu thu.
7. Bộ lọc đơn tách trạng thái xử lý, hình thức nhận và tình trạng thanh toán. Bảng giao hàng chỉ lấy đơn giao tận nơi, hiển thị số tiền còn phải thu và lý do thất bại.
8. Thanh đầu trang thống nhất phạm vi một cửa hàng/một kho. Giữ Ant Design và phong cách xanh nước đã thống nhất.

## 4. Thiết kế màn hình cần hoàn thiện tiếp

### Không gian nội bộ

- **Tổng quan:** đơn cần xác nhận, đơn trễ, hàng sắp hết/hết hạn, khoản chưa thu và chuyến cần đối soát. Doanh thu và tiền cọc là các chỉ tiêu khác nhau.
- **Đơn hàng:** danh sách + bộ lọc; hộp thoại giao nhận/dòng hàng/thanh toán/vỏ/lịch sử. Không gộp trạng thái đơn, giao hàng và tiền thu thành một nhãn.
- **Kho:** các tab Tồn khả dụng, Lô hàng, Phiếu nhập, Giao dịch kho. Mỗi phiếu nhập có nhà cung cấp, nhiều dòng, lô, ngày sản xuất/hạn dùng, số thực nhận và giá vốn. Hiện chưa bổ sung các tab không có dữ liệu/nghiệp vụ.
- **Giao hàng:** tab Chuyến giao và Đơn chưa xếp chuyến; chi tiết chuyến có tài xế, danh sách điểm, hàng/tiền/vỏ bàn giao và đối soát cuối chuyến. Bảng đơn hiện có là nền cho màn này, chưa thay thế quản lý chuyến.
- **Thanh toán:** phiếu thu, yêu cầu QR, hoàn tiền, đối soát tiền mặt theo ca/chuyến. Hộp thoại đơn hiện cung cấp phần thu tiền cơ bản.
- **Vỏ & cọc:** số dư theo khách/loại vỏ, sổ giao/thu, cọc thu/hoàn và chênh lệch. Không cho sửa trực tiếp số dư để làm mất lịch sử.
- **Danh mục:** Sản phẩm, Khách hàng, Nhà cung cấp, Nhân viên. Hồ sơ khách có nhiều địa chỉ, đơn cũ giữ địa chỉ đã chốt.
- **Báo cáo:** bộ lọc kỳ và sáu nhóm báo cáo ở mục 5.7; dữ liệu báo cáo phải cùng nguồn với giao dịch.
- **Quản trị:** vai trò, tài khoản, chính sách giá/cọc, thông tin cửa hàng, nhật ký và phê duyệt sai lệch.

### Không gian khách hàng và người giao

- Khách: danh mục → giỏ hàng → thông tin giao/đổi vỏ → gửi yêu cầu → tra cứu. Không bắt đăng ký; liên kết tra cứu phải có token khó đoán, không chỉ dựa vào mã đơn.
- Người giao: màn hình điện thoại ưu tiên chuyến được giao, địa chỉ/số điện thoại, giờ hẹn, hàng, tiền/vỏ cần thu, nút ghi kết quả và bàn giao. Không dùng đầy đủ menu quản trị của chủ cửa hàng.

## 5. Thứ tự triển khai và tiêu chí chấp nhận

### P0 — Dữ liệu thật và kiểm soát truy cập

- Hoàn thiện xác thực và quyền API; dữ liệu đơn/kho/phiếu thu tồn tại sau tải lại và được nhìn nhất quán từ hai phiên.
- Chốt trạng thái đơn/giao/thanh toán, tồn vật lý/giữ/khả dụng, mã khách và liên kết vỏ/cọc.
- Hai nhân viên cùng xác nhận đơn cuối kho: chỉ lượng còn đủ được chấp nhận; không âm tồn hoặc giữ hàng hai lần.
- Backend tự tính tiền và kiểm tra quyền, không tin đơn giá/tổng tiền/trạng thái do frontend gửi.

### P1 — Luồng bán hàng tối thiểu đúng nghiệp vụ

- Hồ sơ khách, sản phẩm ngừng kinh doanh, đơn nhiều dòng, tại quầy/giao tận nơi, xác nhận/giữ hàng, xuất giao và hủy/hoàn.
- Phiếu thu có danh tính/thời điểm; không ghi nhận vượt dư, không trùng tham chiếu; giao xong chưa thu đủ vẫn còn khoản phải thu.
- Giá sản phẩm đổi không làm thay đổi dòng đơn đã xác nhận.
- Đơn hủy không vào doanh thu; cọc không vào doanh thu bán nước.

### P2 — Nhập theo lô, vỏ/cọc và chuyến giao

- Nhà cung cấp → phiếu nhập kiểm nhận → lô đủ điều kiện → tồn khả dụng. Hàng thiếu/hỏng/hết hạn không tăng tồn bán được.
- Xuất theo hạn gần nhất còn hiệu lực; phiếu điều chỉnh có lý do, người và lịch sử.
- Một đơn không ở hai chuyến đang chạy; giao thất bại có lần giao mới; tài xế bàn giao tiền/vỏ/hàng hoàn.
- Số dư vỏ/cọc tái tính được từ giao dịch; hoàn cọc đúng loại vỏ và điều kiện, có xử lý sai lệch.

### P3 — Kênh khách hàng, QR và báo cáo

- Khách không tài khoản đặt và tra cứu riêng; đăng ký chỉ để tiện lưu địa chỉ/lịch sử.
- QR sinh đúng đơn/số tiền/nội dung; sinh QR không đồng nghĩa nhận tiền. Chọn xác nhận thủ công hoặc tích hợp dịch vụ trước khi làm webhook.
- Báo cáo có khoảng thời gian; đối chiếu được với các chứng từ nguồn; xuất dữ liệu hoạt động thật.

## 6. Những chỗ cần chốt trong đặc tả

- “Admin” trong mục 6.7 là chủ cửa hàng hay một vai trò hệ thống riêng? Hiện chưa dùng tên hiển thị “Quản trị viên” làm bằng chứng có quyền.
- Chính sách cọc từng loại vỏ, vỏ khác nhãn/khác dung tích, thu vượt số dư, bồi thường mất/hỏng và hoàn cọc chưa có công thức/điều kiện cụ thể.
- Chính sách giảm giá, phí giao theo vùng, quyền sửa, hủy sau xuất, hoàn tiền một phần và duyệt sai lệch chưa chi tiết.
- Mục 6.5 dùng điều kiện nhận/giao thành công cho đơn hoàn tất; mục 5.6/VII có thêm thanh toán. Bản mock chọn hoàn tất sau nhận hàng **và thu đủ tiền**, giữ trạng thái đã nhận/giao khi chưa thu đủ. Cần chốt định nghĩa này trong API.
- Có mô tả thu tiền qua nhiều tình huống nhưng chưa nêu rõ thanh toán một phần. Mock giữ từng phiếu thu và chỉ đánh dấu đã thanh toán khi đủ tổng tiền; không coi đây là chính sách cho mua nợ dài hạn.
- Ngưỡng cảnh báo hết hạn 120 ngày và ngưỡng tồn hiện là cấu hình mẫu, không phải con số quy định trong Word.
- Khung giờ hẹn, thời gian trễ cho phép, lịch tài xế và sức chứa chuyến chưa được định nghĩa.
- Dữ liệu khách nhận tại quầy được phép vãng lai theo tài liệu, trong khi schema ban đầu bắt buộc `customer_order.customer_id NOT NULL`; cần quyết định biểu diễn khách vãng lai trước migration tiếp theo.

Các phần pháp lý ở mục 6.8 được ghi nhận là yêu cầu nghiệp vụ của báo cáo, không được hiểu là đã kiểm chứng sự tuân thủ pháp luật của sản phẩm.

## 7. Bằng chứng trong repository

- Giao diện, route: [App.tsx](../src/app/App.tsx), [navigation.ts](../src/app/navigation.ts).
- Dữ liệu mô phỏng: [db.ts](../src/mocks/db.ts), [data.ts](../src/mocks/data.ts), [mockRequest.ts](../src/mocks/mockRequest.ts).
- Luồng đơn sau điều chỉnh: [orderService.ts](../src/features/orders/orderService.ts), [types.ts](../src/features/orders/types.ts), [CreateOrderModal.tsx](../src/features/orders/components/CreateOrderModal.tsx), [OrderDetailsModal.tsx](../src/features/orders/components/OrderDetailsModal.tsx).
- Kho mới ở mức sản phẩm: [productService.ts](../src/features/inventory/productService.ts), [ReceiveStockModal.tsx](../src/features/inventory/components/ReceiveStockModal.tsx).
- Báo cáo mẫu độc lập: [reportService.ts](../src/features/reports/reportService.ts).
- Backend chưa xác thực: [AuthController.java](../../backend/src/main/java/com/aquaflow/auth/api/AuthController.java), [SecurityConfig.java](../../backend/src/main/java/com/aquaflow/shared/config/SecurityConfig.java).
- Schema ban đầu: [V1__initial_schema.sql](../../backend/src/main/resources/db/migration/V1__initial_schema.sql). Có app_user, supplier, product, inventory_item, customer, customer_order, order_item, bottle_transaction; chưa có receipt/batch/trip/attempt/payment/deposit/audit đầy đủ.

## 8. Kiểm tra thay đổi

Chạy trong `frontend`: `npm run lint`, `npm run build`, `npm test`.

Kiểm thử nghiệp vụ tự động tập trung vào: đơn nhiều dòng, số lượng nguyên dương, cộng dồn sản phẩm trùng, không âm tồn/không trừ dở dang khi lỗi, giữ hàng khi xác nhận, chốt giá, hủy giải phóng giữ hàng, chặn hàng hết hạn, quầy không đi giao, giao thất bại/giao lại, thu một phần/đủ, nhận trước hoặc thu trước, không thu quá dư hoặc trùng tham chiếu.

Kiểm tra trình duyệt: tạo đơn, mở chi tiết, ghi nhận tiền, ghi kết quả giao, lọc, modal/hộp thoại trên màn hình nhỏ. Các kiểm tra này xác nhận bản frontend/mock, **không xác nhận backend, persistence, bảo mật quyền hay tích hợp ngân hàng**.
