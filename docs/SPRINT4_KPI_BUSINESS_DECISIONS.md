# AquaFlow Sprint 4 – KPI Business Decisions

## 1. Executive Summary

Tài liệu này định nghĩa các KPI cần thảo luận trước khi mở rộng Dashboard và Reporting Sprint 4. Nội dung dựa trên code, Flyway migration, API contract, frontend adapter và PostgreSQL integration test hiện có.

Repository hiện có một hệ thống báo cáo duy nhất gồm năm API dưới `/api/v1/admin/reports`. Các API đã có filter ngày theo `Asia/Ho_Chi_Minh`, filter channel/fulfillment, phân trang, quyền ADMIN và snapshot `REPEATABLE_READ`. `ReportPostgresIntegrationTest` đã kiểm tra timezone boundary, discount, đơn COUNTER, payment confirmed/pending, return, tồn lùi, adjustment, phân trang và quyền.

Các chỉ số đơn hàng, doanh thu theo contract hiện tại, tiền thanh toán đã xác nhận, sản lượng sản phẩm, movement kho, delivery attempt và sổ cọc đã có dữ liệu nền. AOV, tỷ lệ giao thành công theo đơn, giá trị tồn theo cost, COGS/Gross Profit, Category độc lập, điều chỉnh kho, khách hàng mới và khách hàng giá trị cao cần được quyết định trước khi code.

PR #94 đang OPEN và không thuộc tài liệu này.

## 2. Hiện trạng năm Report API

| API | Code chính | Dữ liệu | Frontend | Đánh giá |
|---|---|---|---|---|
| `/admin/reports/summary` | `ReportController.summary()` → `ReportRepository.summary/daily/channels/deposits/receipts` | Đơn, doanh thu, payment, ngày, channel, cọc, nhập | `LiveReportsPage`, `useDailyRevenue`, Dashboard | Có; revenue và collected là hai khái niệm |
| `/admin/reports/products` | `ReportRepository.products()` | Sold quantity, returned quantity, revenue | `LiveReportsPage` | Có; dựa trên đơn đã giao |
| `/admin/reports/inventory` | `ReportRepository.inventory()` | Opening, receive, return, issue, adjustment, closing | `LiveReportsPage`, Inventory | Có số lượng; chưa có inventory value |
| `/admin/reports/delivery` | `ReportRepository.delivery()` | Attempt, success/fail, late, cash difference | `LiveReportsPage` | Có; hiện đếm attempt |
| `/admin/reports/customers` | `ReportRepository.customers()` | Đơn giao và revenue theo customer | `LiveReportsPage` | Có; guest gom thành nhóm riêng |

Contract chung: `from/to` bắt buộc, tối đa 366 ngày, không quá hôm nay; khoảng UTC được xây theo `Asia/Ho_Chi_Minh`; `channel` là `WEB|COUNTER|PHONE|MESSAGE`; `method` là `COUNTER|DELIVERY`; section có `page/size`; ADMIN được đọc, role khác bị từ chối; kỳ rỗng trả zero và bucket ngày.

## 3. KPI definitions và công thức hiện tại

### Order và Revenue

| KPI | Công thức/nguồn hiện tại | Trạng thái |
|---|---|---|
| Tổng số đơn | `orders.created_at` trong kỳ | Đủ dữ liệu |
| Số đơn đã giao | `DELIVERED/COMPLETED` theo `delivered_at`; COUNTER cũ fallback dispatch time | Đủ dữ liệu |
| Số đơn hủy | `cancelled_at` trong kỳ | Đủ dữ liệu |
| Doanh thu | `subtotal - discount_amount + delivery_fee - order_returns` của đơn đã giao | Có nhưng khác phương án “chỉ hàng hóa” |
| Tiền thực thu | Payment `CONFIRMED`: `IN` dương, `OUT` âm, theo `confirmed_at` | Đủ dữ liệu |
| Tiền cọc vỏ | `deposit_transactions`/`bottle_transactions` | Có ledger riêng |
| AOV | Chưa có field riêng | Chờ quyết định mẫu số |

Integration test hiện xác nhận `ordersCreated=3`, `ordersDelivered=2`, `ordersCancelled=1`, `revenue=106`, `netPayments=130`; payment pending không được tính và order cancelled không tăng revenue.

### Delivery

| KPI | Code/API hiện tại | Đánh giá |
|---|---|---|
| Đơn đưa đi giao | Có thể suy từ order/assignment/dispatch; delivery report hiện trả attempt | Cần query order-level |
| Đơn thành công/thất bại | Có order status và `delivery_attempts.outcome` | Đủ dữ liệu, cần chọn đơn vị đo |
| Tỷ lệ thành công | Chưa có metric order-level riêng | Cần quyết định |
| Số lượt giao lại | Có `attempt_no`, assignment mới, dispatch history | Có dữ liệu, chưa có field KPI |
| Đơn giao trễ | Hiện đánh dấu SUCCESS sau `requested_delivery_at` | Có, cần chốt theo attempt hay order |
| Chênh lệch tiền | `cashReported - cashConfirmed` từ handover | Có; không phải công nợ khách |

Một đơn có thể có nhiều attempt và redelivery assignment; không dùng số attempt làm số đơn thành công nếu KPI được định nghĩa theo đơn.

### Inventory, Product và Customer

- Inventory có `onHand`, `reserved`, `inventory_movements`, `unit_cost` ở purchase item và movement `RECEIVE/DISPATCH/RETURN/ADJUST`. Chưa có chính sách cost layer.
- Product report có sold quantity, returned quantity, revenue; sold lấy từ đơn đã giao. Low stock dùng `onHand - reserved` so với `low_stock_threshold`.
- Customer report có orders/revenue theo `customer_id`; guest order không có hồ sơ được gom riêng. Chưa có metric “customer mới” hoặc “high value” được chốt.
- Không có Category model/API độc lập; frontend có `inferCatalog()` heuristic theo tên/đơn vị. Không dùng heuristic làm dimension báo cáo chính thức.

## 4. Bảng quyết định KPI-01 đến KPI-10

Các quyết định dưới đây là baseline Sprint 4 đã được xác nhận trong phiên làm việc ngày 2026-11-08; việc triển khai vẫn phải có test và review.

| ID | Nội dung cần quyết định | Các phương án | Đề xuất | Ảnh hưởng Backend | Ảnh hưởng Frontend | Cần migration? | Trạng thái |
|---|---|---|---|---|---|---|---|
| KPI-01 | Định nghĩa doanh thu | Hàng hóa sau discount/return; hàng hóa + delivery fee; tiền đã thu | Tổng giá trị hàng hóa của đơn `DELIVERED`, sau discount và trừ return hợp lệ; không gồm delivery fee, deposit hoặc `CANCELLED` | Đổi summary/products/customers query và integration fixtures | Đổi label/tooltip/export | Không nếu chỉ đổi query | APPROVED – Sprint 4 baseline |
| KPI-02 | Cọc vỏ có nằm trong doanh thu? | Gộp; tách riêng; chỉ nằm trong collected | Tách riêng khỏi revenue; hiển thị bằng KPI deposit riêng | Đảm bảo payment/report không gộp deposit; dùng ledger | Thẻ cọc riêng, không cộng revenue | Chưa cần; V23/V24 đã có ledger | APPROVED – Sprint 4 baseline |
| KPI-03 | Cách tính AOV | Revenue/đơn tạo; revenue/đơn delivered; collected/đơn | `Revenue / số đơn DELIVERED`; không có đơn thì bằng 0 | Thêm field summary hoặc contract | Hiển thị rõ mẫu số | Không nhất thiết | APPROVED – Sprint 4 baseline |
| KPI-04 | Tỷ lệ giao thành công | SUCCESS attempt/attempt; đơn delivered/đơn delivery; cuối cùng SUCCESS/đơn dispatch | Theo đơn: đơn DELIVERY cuối cùng thành công / đơn DELIVERY đã dispatch; retry không đếm trùng | Cần query order-level, không dùng attempt count | Đổi label/mẫu số | Không | APPROVED – Sprint 4 baseline |
| KPI-05 | Giá trị tồn kho | Giá nhập gần nhất; bình quân gia quyền; cost layer | Dùng giá nhập gần nhất cho báo cáo vận hành; ghi rõ không phải số liệu kế toán | Thêm cost query/service theo latest unit cost | Hiển thị phương pháp định giá | Không trong Sprint 4 baseline | APPROVED – Sprint 4 baseline |
| KPI-06 | COGS/Gross Profit | Không làm; giá gần nhất; weighted average | Hoãn khỏi Sprint 4 cho đến khi có chính sách giá vốn | Chưa triển khai query/cost layer | Chưa làm UI KPI này | Không | APPROVED – DEFERRED |
| KPI-07 | Category độc lập | Không có; heuristic; Category + FK Product | Không triển khai dimension Category chính thức trong Sprint 4 | Không tạo entity/API/migration mới | Không xây CRUD/filter Category | Không | APPROVED – DEFERRED |
| KPI-08 | API điều chỉnh tồn | Không có command; ADJUST có reason/audit; ngoài hệ thống | Chỉ báo cáo movement `ADJUST` hiện có; chưa thêm API chỉnh kho mới | Không tạo controller/service mới trong Sprint 4 | Không làm form chỉnh kho | Không | APPROVED – DEFERRED |
| KPI-09 | Khách hàng mới | `customers.created_at`; first order; loại guest | Customer đăng ký có `created_at` trong kỳ; guest tách riêng | Dùng cột hiện có, không trộn user count | Label/tooltip nêu rõ guest không tính vào customer mới | Không | APPROVED – Sprint 4 baseline |
| KPI-10 | Khách hàng giá trị cao | Revenue; số đơn; quantity; collected | Xếp hạng theo revenue của đơn `DELIVERED` trong kỳ; loại deposit | Dùng customer report sort/group | Hiển thị top customer và filter | Không | APPROVED – Sprint 4 baseline |

## 5. Phân tích dữ liệu và database

### Order/payment/return

- `orders` có status, fulfillment type, subtotal, discount, delivery fee và các timestamp cần thiết.
- `order_items` có quantity, unit price, line total.
- `payments` có direction, method, amount, status, confirmed time.
- `order_returns` giảm revenue theo kỳ trả; `inventory_returns` từ giao thất bại không giảm revenue vì đơn chưa bán thành công.
- Payment pending không tăng collected.
- Nếu payment gộp tiền hàng và cọc, dữ liệu hiện tại chưa đủ để tự động tách KPI tài chính; cần quyết định hoặc contract dữ liệu.

### Inventory/delivery

- Tồn cuối được dựng từ balance hiện tại trừ movement sau kỳ; thiếu movement lịch sử thì không thể đảm bảo số liệu đầu kỳ.
- Purchase item có `unit_cost`, nhưng chưa có chính sách FIFO/weighted-average cost.
- `ADJUST_UP/DOWN` đã có trong enum/report nhưng chưa có command API điều chỉnh thủ công có reason và workflow.
- Delivery assignment/attempt phân biệt được assignment, attempt number và outcome; report hiện đang đếm attempt.

### Bottle ledger/V23

- V23 backfill `liability_delta` bằng `quantity * bottle_types.deposit_unit_amount` tại thời điểm migration.
- Nếu giá cọc thay đổi, nghĩa vụ lịch sử có thể lệch giá tại ngày giao dịch cũ.
- V24 snapshot `unit_deposit` trong manifest mới tốt hơn cho giao dịch mới.
- Không sửa V23 trong tài liệu này; cần snapshot lịch sử đại diện để đối soát.

## 6. KPI đã chốt và KPI hoãn

### Baseline đã chốt

Doanh thu hàng hóa của đơn `DELIVERED`, payment đã xác nhận, tiền cọc tách riêng, AOV theo đơn `DELIVERED`, delivery success theo order, giá trị tồn theo giá nhập gần nhất cho mục đích vận hành, customer mới theo `created_at` và high-value theo delivered revenue.

### Đủ dữ liệu nhưng cần triển khai/đổi contract

AOV, order-level delivery success rate, số đơn đưa đi giao, số lượt redelivery, inventory valuation và các field customer mới/high-value cần query, DTO và integration test mới.

### Đã hoãn khỏi Sprint 4

COGS/Gross Profit, Category dimension chính thức và API điều chỉnh kho thủ công. Các mục này không được tự triển khai trong Sprint 4 baseline.

## 7. Sprint 4 backlog đề xuất

Các task dưới đây là đề xuất, chưa phải cam kết triển khai. Mỗi task ghi rõ đủ mục tiêu, phạm vi, module/API, dependency, điều kiện nghiệm thu, test và rủi ro.

### Backend

| Task | Mục tiêu và phạm vi | File/module/API dự kiến | Dependency | Acceptance criteria | Test cases | Rủi ro |
|---|---|---|---|---|---|---|
| BE-KPI-01 | Chuẩn hóa công thức, timezone, filter, empty period và response | `ReportController`, `ReportService`, `ReportRepository`, report DTOs; giữ nguyên 5 endpoint | KPI-01..04 được duyệt | Contract được ghi trong docs; không tạo API trùng; tất cả field có ý nghĩa thống nhất | Report integration: ngày biên, rỗng, timezone, quyền ADMIN | Thay đổi DTO có thể ảnh hưởng FE |
| BE-KPI-02 | Tách delivery KPI theo order khỏi lịch sử attempt; xử lý redelivery không đếm trùng | Delivery report query/service; `DeliveryAttempt` grouping | KPI-04 và định nghĩa late/redelivery | Một order chỉ tính một lần ở KPI order-level; attempt detail vẫn truy vấn được | success→failed→success, nhiều attempt, failed-only, late | Dữ liệu cũ thiếu liên kết order/attempt |
| BE-KPI-03 | Cung cấp giá trị tồn kho/COGS chỉ theo chính sách đã duyệt | Inventory valuation/report query; không sửa migration cũ | KPI-05 và/hoặc KPI-06 | Cost source truy vết được; không trộn giá nhập và giá vốn; có đối soát nhiều cost layer | receipt nhiều giá, dispatch, return sellable/damaged, opening balance | Thiếu cost history làm KPI NOT VERIFIED |
| BE-KPI-04 | API điều chỉnh tồn kho thủ công nếu nhóm phê duyệt | Inventory adjustment service/controller/repository; API contract mới nếu cần | KPI-08; quyền và audit policy | Role, reason, transaction, idempotency, rollback và audit log đầy đủ | allowed/denied role, duplicate, rollback, concurrent adjustment | Tạo endpoint trùng hoặc làm sai số dư |
| BE-KPI-05 | Đối soát bottle ledger và nêu rõ sai lệch lịch sử V23 | Bottle ledger/report service; không sửa V23 | KPI-02 và dữ liệu lịch sử đại diện | Đối soát theo customer/type; snapshot giá mới giữ nguyên lịch sử | rate change trước/sau V23, return, outstanding balance | Migration-time rate có thể không khôi phục được |

### Frontend

| Task | Mục tiêu và phạm vi | File/module/API dự kiến | Dependency | Acceptance criteria | Test cases | Rủi ro |
|---|---|---|---|---|---|---|
| FE-KPI-01 | Dashboard/reports dùng summary thật, có diễn giải KPI | `reportApi.ts`, `reportService.ts`, `DashboardPage`, report components | BE-KPI-01; formula được duyệt | Label/unit/period đúng; loading/error/empty; ADMIN guard; không mock | Vitest API success/error/empty, role rendering | Đổi field làm vỡ component hiện tại |
| FE-KPI-02 | Hiển thị delivery theo order và attempt riêng | Delivery report page/components; delivery endpoint hiện tại | BE-KPI-02, KPI-04 | Không gọi failed attempt là failed order nếu contract nói order-level | retry sequence, late, no data, pagination | UI gây hiểu nhầm nếu công thức chưa chốt |
| FE-KPI-03 | Hiển thị valuation/adjustment khi backend contract ổn định | Inventory report components; adjustment API nếu được duyệt | BE-KPI-03/04, KPI-05/08 | Hiển thị source/cost method; quyền và confirm/error rõ ràng | read-only, permitted edit, denied edit, rollback error | Cho thao tác khi backend chưa có idempotency |
| FE-KPI-04 | Customer KPI theo định nghĩa customer mới/high-value đã duyệt | Customer report components/API client | KPI-09/10, BE-KPI-01 | Không suy diễn customer từ user count; empty/period state đúng | new customer boundary, repeat customer, no orders | Định nghĩa thay đổi gây sửa UI |

### Integration, QA và tài liệu

| Task | Mục tiêu và phạm vi | File/module/API dự kiến | Dependency | Acceptance criteria | Test cases | Rủi ro |
|---|---|---|---|---|---|---|
| INT-KPI-01 | Tạo dataset kiểm soát và đối soát nguồn với 5 report APIs | PostgreSQL test fixtures, report integration tests | BE contract; không dùng production DB | Order, payment, return, delivery, inventory và ledger đều có expected values | delivered/cancelled, partial payment, retry, damaged return, adjustment | Fixture thiếu case làm số liệu tưởng đúng |
| INT-KPI-02 | Kiểm tra FE/BE contract xuyên suốt | OpenAPI/docs, API clients, DTO mapping | BE-KPI-01 và FE tasks | Field, enum, timezone, pagination, error response khớp | contract smoke, malformed params, unauthorized | Backend/Frontend merge lệch thời điểm |
| QA-KPI-01 | Bổ sung browser E2E sau khi được chấp thuận framework | Chưa có framework; đề xuất Playwright, test config riêng | Quyết định thêm dependency và môi trường PostgreSQL | Browser thật gọi backend thật; dữ liệu test cô lập; có PASS/FAIL tái chạy | checkout, delivery, authorization, return | Không thể coi là VERIFIED khi chưa có framework |
| QA-KPI-02 | Regression toàn hệ thống sau thay đổi KPI | Maven, report/delivery/inventory suites, frontend lint/typecheck/test/build | Các BE/FE task đã merge vào branch test | Không giảm assertion; test lặp ổn định; phân loại lỗi cũ/mới | full backend 3 lần, frontend suites, migration clean DB | Flaky test hoặc môi trường local khác CI |
| DOC-KPI-01 | Cập nhật contract, công thức và decision log sau khi phê duyệt | `docs/REPORTS_API.md`, KPI decision doc, API examples | Business approval KPI-01..10 | Tài liệu khớp code/test; không ghi đề xuất thành quyết định | docs link/checklist review | Tài liệu lệch sau khi code thay đổi |

Mỗi task chỉ được coi là Done khi có acceptance criteria đạt, test tương ứng PASS, API contract cập nhật (nếu có) và thay đổi đã tích hợp vào `develop`.

## 8. Phân công năm thành viên

Repository không có bằng chứng đủ tin cậy để gán tên cá nhân. Đề xuất theo vai trò:

| Vai trò | Phần việc độc lập | Dependency |
|---|---|---|
| Backend 1 | Order/revenue/AOV và order-level delivery | KPI-01, KPI-03, KPI-04 |
| Backend 2 | Inventory cost, adjustment, bottle ledger/V23 | KPI-05, KPI-06, KPI-08 và snapshot lịch sử |
| Backend 3 | Report contract, customer KPI, orchestration và API docs | Phối hợp BE1/BE2, không trùng query |
| Frontend 1 | Dashboard, summary, order/revenue/customer KPI | Summary DTO và công thức đã duyệt |
| Frontend 2 | Inventory/delivery report UI và adjustment UI nếu được duyệt | BE2 cost/adjustment contract; PR #94 ngoài phạm vi |

BE1/BE2/BE3 có thể phân tích song song. FE khóa UI sau khi công thức và response DTO được chốt.

## 9. Acceptance Criteria tổng thể

- Mỗi KPI có định nghĩa, tử số/mẫu số, timezone, owner và trạng thái phê duyệt.
- Revenue không trộn payment, deposit hoặc debt.
- CANCELLED không tăng revenue.
- Redelivery không làm tăng số đơn thành công khi KPI đo theo order.
- Movement không bị đếm hai lần; damaged return không tăng sellable stock.
- API hiện tại được tái sử dụng; API mới chỉ tạo sau decision và contract.
- ADMIN được đọc report; role khác nhận 401/403 đúng contract.
- Dataset reconciliation có expected values và PostgreSQL integration test.
- FE có loading/error/empty và không dùng mock cho tài khoản thật.
- KPI cost, Category, adjustment và V23 chỉ Done sau khi có business decision và test.

## 10. Risks và Open Questions

### Risks

- V23 dùng giá cọc tại migration cho liability lịch sử.
- Tồn lịch sử không khôi phục được nếu movement cũ thiếu.
- `ReportController` gọi repository trực tiếp và dùng `Map<String,Object>`, nên contract mở rộng khó kiểm soát.
- Delivery report hiện đếm attempt; đổi order-level cần tránh breaking UI.
- Các API summary/section đọc snapshot riêng, có thể lệch thời điểm nếu giao dịch mới phát sinh giữa request.
- Chưa có Playwright/Cypress/Puppeteer trong repository.

### Open Questions

1. Return nào được trừ khỏi revenue: chỉ return đã kiểm nhận hay mọi return đã tạo?
2. Payment gộp cọc được tách ở dữ liệu hay chỉ khi report?
3. Latest unit cost có đủ cho kỳ lịch sử hay cần snapshot cost theo ngày?
4. Late delivery dùng `requested_delivery_at` hay SLA khác?
5. Playwright có được chấp thuận làm framework browser E2E không?
6. Có snapshot dữ liệu lịch sử để đối soát V23 không?

## 11. Phạm vi kiểm tra và giới hạn

Đã kiểm tra `ReportController`, `ReportRepository`, `ReportPostgresIntegrationTest`, frontend `reportApi`, `LiveReportsPage`, `reportService`, `DashboardPage`, các entity Order/OrderItem/Payment/Inventory/Movement/Delivery/Customer/Product, enum trạng thái và Flyway V1–V24.

Đã xác nhận bằng code/test: năm API tồn tại và frontend tài khoản thật sử dụng; report tests kiểm tra timezone, discount, payment, returns, movement, pagination và authorization; giá trị fixture khớp API.

Baseline KPI đã được xác nhận cho Sprint 4 nhưng chưa được triển khai toàn bộ. Dữ liệu production/historical V23, browser E2E, hiệu năng dữ liệu lớn và chi tiết return/payment cần tiếp tục xác minh; COGS, Category và adjustment API đã được ghi nhận là hoãn.

