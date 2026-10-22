# AquaFlow — Sprint 1 code review

Ngày review: 22/10/2026 (Asia/Saigon) · Nhánh `develop` · commit `27489d1`.

## 1. Tổng quan

Backend đã tách `auth`, `inventory`, `customer` theo Controller → Service → Repository; DTO, Bean Validation, transaction, JWT và Flyway đã có. Frontend có routing, React Query, màn đăng nhập, layout và các màn nghiệp vụ với trạng thái loading/error. Build tĩnh đều pass. Tuy nhiên Product, Supplier, Customer và Order trên frontend vẫn chạy bằng dữ liệu trong bộ nhớ. Vì vậy chưa có luồng FE–BE cho CRUD Sprint 1, dù đăng nhập và `/auth/me` đã gọi API thật. Kết luận cho hệ thống tích hợp: **NOT READY TO MERGE**.

Phạm vi bằng chứng: inventory toàn bộ cây source và đọc sâu các luồng Sprint 1, test, migration, workflow, tài liệu trong workspace. Không tìm thấy bản API Contract hay ERD đã thống nhất được version hóa riêng trong repo; phần đối chiếu contract dưới đây dùng DTO/controller hiện có làm chuẩn tạm thời. Không khẳng định schema đã khớp ERD bên ngoài repo.

## 2. Lỗi và thiếu sót theo ưu tiên

### Critical

**C1 — FE CRUD Sprint 1 không kết nối BE (lỗi chức năng tích hợp).** `frontend/src/features/inventory/productService.ts:1-23`, `frontend/src/features/suppliers/supplierService.ts:1-21`, `frontend/src/features/customers/customerService.ts:1-2,96-110`, `frontend/src/features/orders/orderService.ts:194-195`. Các service thao tác `mocks/db` qua `mockRequest`; chỉ auth dùng Axios thật tại `frontend/src/features/auth/authService.ts:30-38`. Tạo/sửa ở UI không ghi PostgreSQL; tải lại trang có thể mất thay đổi. **Sửa:** tạo adapter API thật cho Product/Supplier/Customer, mapping DTO rõ ràng, xử lý 401/403/404/409 và test E2E với BE/PostgreSQL; giữ demo trong chế độ tách biệt.

### High

**H1 — Test “integration” không kiểm chứng database/migration.** `backend/src/test/java/com/aquaflow/auth/api/AuthControllerIntegrationTest.java:35-76`, `backend/src/test/java/com/aquaflow/inventory/api/ProductControllerIntegrationTest.java:38-76`, `backend/src/test/java/com/aquaflow/inventory/api/SupplierControllerIntegrationTest.java:38-76` đều loại DataSource/JPA/Flyway và mock repository. Build pass không bảo đảm Hibernate `ddl-auto: validate` hay V1/V2 chạy được trên PostgreSQL (`backend/src/main/resources/application.yml:6-15`). **Sửa:** thêm test dùng PostgreSQL/Testcontainers thật, chạy Flyway, kiểm CRUD/constraint/transaction; chạy cùng Java 21 như CI.

**H2 — Token của user đã bị xóa có thể gây lỗi server thay vì 401.** `backend/src/main/java/com/aquaflow/auth/security/JwtAuthenticationFilter.java:35-46` chỉ bắt `JwtException | IllegalArgumentException`; `backend/src/main/java/com/aquaflow/auth/security/AuthUserDetailsService.java:19-22` ném `UsernameNotFoundException` khi subject không còn trong DB. Ngoại lệ xảy ra trong filter trước controller, không được chuyển thành unauthorized có kiểm soát. **Sửa:** bắt `UsernameNotFoundException`/`AuthenticationException` tại filter, xóa security context và trả 401 thống nhất; thêm test token còn hạn sau khi user bị xóa.

**H3 — Quyền tạo Product/Supplier ở FE và BE khác nhau.** Mock cho phép `SALES_STAFF` tạo sản phẩm tại `frontend/src/features/inventory/productService.ts:21-23`, tạo NCC tại `frontend/src/features/suppliers/supplierService.ts:10-11`; backend yêu cầu `ADMIN` cho mọi phương thức ghi ở `backend/src/main/java/com/aquaflow/shared/config/SecurityConfig.java:56-58`. UI cũng hiện nút thêm sản phẩm/NCC ở `frontend/src/features/inventory/ProductsPage.tsx:89` và `frontend/src/features/suppliers/SuppliersPage.tsx:43`. Khi nối API, nhân viên bán hàng sẽ gặp 403. **Sửa:** thống nhất ma trận quyền Sprint 1; cập nhật FE guard và BE policy/test theo quyết định đó.

**H4 — Customer phone uniqueness chỉ tồn tại trong mock.** `frontend/src/features/customers/customerService.ts:80-83` từ chối trùng số điện thoại, nhưng `backend/src/main/resources/db/migration/V1__initial_schema.sql:19-24` và `backend/src/main/java/com/aquaflow/customer/application/CustomerService.java:30-40` không có ràng buộc/kiểm tra tương ứng. Dữ liệu nhập qua API có thể trùng, gây sai logic tìm/ghép khách sau khi tích hợp. **Sửa:** chốt quy tắc phone có bắt buộc/duy nhất hay không; nếu có, thêm index unique phù hợp với soft delete qua migration mới, kiểm tra ở service, map vi phạm thành 409 và test cạnh tranh.

**H5 — Database mới không có tài khoản để đăng nhập.** `backend/src/main/resources/db/migration/V1__initial_schema.sql:1-16` tạo `roles/users` nhưng không seed dữ liệu; trong `backend/src/main` không có provisioning user/role, và `backend/src/main/java/com/aquaflow/auth/application/AuthService.java:29-34` chỉ login bằng user đã tồn tại. Một cài đặt mới không thể đăng nhập qua UI nếu chưa có bước cấp tài khoản ngoài ứng dụng. **Sửa:** định nghĩa quy trình bootstrap/admin provisioning an toàn, tài liệu hóa và test trên DB trống; không commit mật khẩu mặc định.

### Medium

**M1 — Danh sách Order phát sinh N+1 query.** `backend/src/main/java/com/aquaflow/customer/order/application/OrderService.java:29-33,56-61` tải toàn bộ order rồi gọi `findAllByOrder_Id` cho từng order. Với N đơn sẽ có tối thiểu N+1 truy vấn và không phân trang. **Sửa:** dùng batch fetch/join projection hoặc lấy items theo tập order IDs, thêm pagination và test query count.

**M2 — CI bỏ qua toàn bộ script test frontend.** `.github/workflows/ci.yml:80-82` và `.github/workflows/cd.yml:77-79` gọi `npm run test --if-present`; `frontend/package.json:6-13` chỉ có `test:orders`, `test:operations`, `test:after-sales`, `test:ux`, `test:report-excel`, không có `test`. Do đó job xanh dù không chạy test nghiệp vụ FE. **Sửa:** thêm script `test` tổng hợp hoặc gọi từng script trực tiếp, bỏ `--if-present`.

**M3 — Lỗi DB constraint/race trả 500 chung.** `backend/src/main/java/com/aquaflow/inventory/application/ProductService.java:27-36` kiểm `existsBySku` trước `save`, nhưng hai request đồng thời vẫn có thể cùng qua bước kiểm; DB có unique SKU tại `backend/src/main/resources/db/migration/V1__initial_schema.sql:53-55`. `backend/src/main/java/com/aquaflow/shared/api/GlobalExceptionHandler.java:18-27` bắt ngoại lệ còn lại thành 500, trái với 409 được khai báo ở `backend/src/main/java/com/aquaflow/inventory/api/ProductController.java:52-58`. **Sửa:** map `DataIntegrityViolationException`/constraint cụ thể thành 409 an toàn, giữ unique constraint làm nguồn sự thật; test hai request đồng thời.

**M4 — Public Product API lộ cả bản ghi đã ngừng kinh doanh.** `backend/src/main/java/com/aquaflow/shared/config/SecurityConfig.java:56` mở GET products; `backend/src/main/java/com/aquaflow/inventory/api/ProductController.java:30-36` cho `active` null/false; `backend/src/main/java/com/aquaflow/inventory/application/ProductService.java:66-71` trả toàn bộ khi không truyền filter. Caller chưa xác thực có thể xem sản phẩm inactive và giá. **Sửa:** public GET chỉ trả active; đặt đường quản trị riêng cho truy vấn inactive, kèm test ẩn dữ liệu.

**M5 — Session FE và JWT lưu trong localStorage.** `frontend/src/shared/api/client.ts:32-52,105-106`, `frontend/src/features/auth/AuthProvider.tsx:39-56,139-145`. Script chạy cùng origin có thể đọc bearer token; FE còn khôi phục user cache trong lúc `/auth/me` lỗi mạng. Đây là rủi ro bảo mật và trạng thái hiển thị, chưa có bằng chứng XSS trong code. **Sửa:** xem xét session bằng HttpOnly cookie + CSRF thích hợp hoặc CSP chặt; khi khởi tạo, có trạng thái `checking` và xác minh `/auth/me` trước khi coi phiên là hợp lệ.

**M6 — Backend Order chỉ đọc, UI Order là mock đầy đủ.** `backend/src/main/java/com/aquaflow/customer/order/api/OrderController.java:28-42` chỉ có GET list/detail; `frontend/src/features/orders/orderService.ts:194-195,198-342` cung cấp create/confirm/deliver/pay/cancel ở mock. Không thể gọi những nghiệp vụ đó qua BE. **Sửa:** nếu Order thuộc scope Sprint 1, triển khai các endpoint/transaction và test; nếu không, ghi rõ màn Order là demo ngoài phạm vi merge.

**M7 — V2 có thể lỗi khi nâng cấp DB đã chứa nhiều địa chỉ mặc định.** V1 cho phép nhiều hàng `is_default = TRUE` của cùng customer (`backend/src/main/resources/db/migration/V1__initial_schema.sql:27-35`); V2 thêm unique partial index ngay, không có bước sửa dữ liệu (`backend/src/main/resources/db/migration/V2__customer_soft_delete_and_default_address.sql:4-6`). Đây là rủi ro có điều kiện, chưa tái hiện vì không có PostgreSQL chạy. **Sửa:** khảo sát dữ liệu hiện hữu và thêm quy trình migration/cleanup an toàn trước khi áp unique constraint; test nâng cấp từ V1 có dữ liệu trùng.

### Low

**L1 — Test dùng annotation đã deprecated.** Ví dụ `backend/src/test/java/com/aquaflow/auth/api/AuthControllerIntegrationTest.java:51`, `backend/src/test/java/com/aquaflow/customer/api/CustomerControllerTest.java:39`; compiler cảnh báo `@MockBean` sẽ bị loại bỏ. **Sửa:** chuyển dần sang `@MockitoBean` và kiểm lại test context.

**L2 — Tài liệu onboarding chưa cập nhật trạng thái auth.** `README.md:10-15,79` và `docs/architecture.md` còn mô tả JWT ở giai đoạn sau/`permitAll`, trong khi `backend/src/main/java/com/aquaflow/shared/config/SecurityConfig.java:53-66` đã bật JWT/phân quyền; `application.yml:24` mặc định secret rỗng nên khởi động cần `APP_JWT_SECRET`. **Sửa:** cập nhật hướng dẫn chạy local và ma trận endpoint/role, dùng secret development riêng qua biến môi trường.

## 3. Chức năng hoàn thành / chưa hoàn thành

| Khu vực | Có trong source | Giới hạn đã xác minh |
| --- | --- | --- |
| Auth | BE login, `/auth/me`, BCrypt, JWT, role filter; FE login Axios | Chưa test với PostgreSQL thật; demo có thể vào layout mà không cần token (`frontend/src/features/auth/AuthProvider.tsx:129-145`), chỉ dùng dữ liệu mock |
| Product/BottleType/Supplier | BE CRUD, DTO/validation, soft delete | FE Product/Supplier vẫn mock; Supplier FE mới có create/list (`frontend/src/features/suppliers/supplierService.ts:8-25`) |
| Customer/Address | BE CRUD, soft delete, địa chỉ mặc định, audit update | FE Customer vẫn mock; phone uniqueness và shape chưa khớp |
| Order | BE đọc list/detail, status domain/service | BE controller chưa có create/transition; FE nghiệp vụ order là mock |
| Delivery/Inventory receipt/payment | Schema và UI demo | Chưa thấy service/controller BE tương ứng; không coi là tính năng production hoàn thành |

## 4. Build, test, lint thực tế

| Lệnh | Kết quả tại workspace |
| --- | --- |
| `backend: mvn -B -ntp clean verify` | **PASS**, 115 tests, 0 failures/errors/skipped; jar được package. Java local 25.0.2, Maven 3.9.16; CI cấu hình Java 21. Có warning `@MockBean`/Mockito agent. |
| `frontend: npm run lint` | **PASS** |
| `frontend: npm run typecheck` | **PASS** |
| `frontend: npm run build` | **PASS**; cảnh báo chunk `exportReport` ~934 kB và `jsx-runtime` ~571 kB; Node local 24.14.0, CI dùng Node 22. |
| `npm run test:orders`, `test:operations`, `test:after-sales`, `test:ux`, `test:report-excel` | **PASS**: lần lượt 9, 8, 8, 4 nhóm tình huống và 4 kiểm tra workbook; chủ yếu xác minh logic demo/mock, không phải FE–BE E2E. |
| PostgreSQL/Flyway/FE–BE runtime | **CHƯA CHẠY ĐƯỢC**: Docker Desktop Linux Engine không hoạt động (`docker info` không kết nối được); không chạy migration lên DB hay gọi HTTP end-to-end. |

Các test `@SpringBootTest` hiện tắt datasource/JPA/Flyway, nên số 115 không chứng minh migration, FK, mapping và transaction trên PostgreSQL. CI/CD workflow đã đọc; không truy cập trạng thái Actions hoặc branch protection thực tế trên GitHub.

## 5. Kiến trúc, bảo mật, database

- Module backend tương đối rõ; `shared` chứa cấu hình/API error, `auth`, `inventory`, `customer` có controller/service/repository. `customer.order` nằm trong module customer. `delivery` chỉ có package marker; nhiều bảng V1 chưa có entity/service. Không thấy dependency repository xuyên module ở các service Sprint 1 đã đọc.
- JWT ký HMAC với secret từ cấu hình, lấy role từ user hiện tại (`JwtAuthenticationFilter.java:35-43`), không tin trực tiếp role claim. BCrypt và `isEnabled` được dùng. Những điểm cần sửa: H2, M4, M5; rate limit login, CSP và token rotation là đề xuất hardening Sprint 2, chưa xác nhận là lỗ hổng khai thác được.
- V1 tạo PK/FK/check cho nhiều bảng; V2 thêm soft delete customer và unique partial index cho địa chỉ mặc định (`backend/src/main/resources/db/migration/V2__customer_soft_delete_and_default_address.sql:1-6`). Entity CustomerAddress dùng `@ManyToOne LAZY` (`backend/src/main/java/com/aquaflow/customer/domain/CustomerAddress.java:21-23`), Product→BottleType cũng LAZY. Order→Customer/Product là scalar ID dù DB có FK (`backend/src/main/java/com/aquaflow/customer/order/domain/Order.java:28-29`, `OrderItem.java:28-29`): chấp nhận được ở ranh giới module, nhưng cần test DB để xác nhận FK. N+1 tại M1.
- Không có ERD được version hóa trong `docs/`/`database/`, nên không thể xác nhận “khớp ERD đã thống nhất”. Không sửa hay chạy migration trên DB trong review này.

## 6. Đối chiếu API Contract đang có

| Luồng | BE contract trong source | FE hiện tại / sai lệch |
| --- | --- | --- |
| Auth | `POST /api/v1/auth/login`, `GET /api/v1/auth/me` (`AuthController.java:23,33,44`) | `authService.ts:33,38` khớp path/shape; chưa có E2E HTTP thật |
| Product | `/api/v1/products` GET/POST/PUT/DELETE, request `sku,name,brand,unit,unitsPerCase,bottleTypeId,salePrice` (`ProductController.java:21,30-87`; `CreateProductRequest.java:12-37`) | `productService.ts` chỉ mock; `types.ts:1-22` dùng `id:string`, `price`, `stock`, `threshold`, `expiry`, không map sang DTO BE |
| Supplier | `/api/v1/suppliers` CRUD, request `name,phone,address` (`SupplierController.java:21,55-90`; `SupplierRequest.java:7-17`) | `supplierService.ts` mock list/create; `types.ts:1-10` thêm `contactName,email`, `id:string`; quyền tạo mâu thuẫn H3 |
| Customer | `/api/v1/sales/customers` CRUD, request `fullName,phone` (`CustomerController.java:24-96`; `CustomerRequest.java:7-18`) | `customerService.ts` mock; `types.ts:6-31` dùng `name,type,area,addresses,note`, `id:string`; cần adapter và endpoint dữ liệu bổ sung hoặc thu hẹp UI |
| Order | `/api/v1/sales/orders` GET list/detail (`OrderController.java:17,28-42`) | FE có các mutation mock không tồn tại ở BE (M6) |

Không có file contract chuẩn độc lập trong repo, nên bảng này không thay cho việc duyệt lại contract đã được nhóm thông qua.

## 7. Việc phải làm trước khi merge `main`

1. Hoàn thành FE–BE CRUD Product/Supplier/Customer hoặc loại các màn mock khỏi phạm vi release; chốt mapping DTO và quyền role, có E2E cho login → CRUD → reload. Cung cấp quy trình tạo tài khoản đầu tiên.
2. Chốt API Contract/ERD version hóa; quyết định phone uniqueness và phạm vi Order Sprint 1. Cập nhật migration mới nếu cần, không sửa V1/V2 đã phát hành.
3. Thêm PostgreSQL integration test chạy Flyway/JPA thật; xác nhận transaction, constraint, địa chỉ mặc định và lỗi cạnh tranh SKU.
4. Sửa H2 và M3; kiểm 401/403/409 bằng HTTP test.
5. Bắt CI chạy các script test FE thật; xác minh CI trên Java 21/Node 22 và trạng thái branch protection trước merge.

## 8. Đề xuất Sprint 2

- Phân trang/filter ở server cho danh sách, tránh N+1 và tải toàn bộ dữ liệu.
- Hoàn thiện Order/Inventory receipt/Delivery theo transaction và test với database thật; không dùng mock làm bằng chứng production.
- Tách API adapter, DTO generated từ OpenAPI hoặc contract test để giảm drift FE–BE.
- Bổ sung rate limiting login, CSP/session strategy, audit cho create/delete và quan sát lỗi có correlation ID.
- Tối ưu bundle ExcelJS/export bằng dynamic import và đo lại kích thước build.

## Kết luận

**NOT READY TO MERGE.** Các lệnh build/lint/test local đều pass, nhưng C1 khiến CRUD Sprint 1 trên UI không ghi/đọc dữ liệu backend; H1 để ngỏ Flyway/JPA/PostgreSQL; H2–H4 là lỗi xử lý token và sai lệch quyền/dữ liệu. Cần hoàn tất mục 7 và chạy E2E trên PostgreSQL trước khi đánh giá lại.

## Cập nhật sau review (22/10/2026)

Phần trên là ảnh chụp review của commit `27489d1`. Sau đó đã triển khai các thay đổi trong worktree, **chưa commit**:

- C1/H3/M6: thêm trang Product, Supplier, Customer và địa chỉ khách dùng API thật cho tài khoản thật; phân quyền ghi Product/Supplier cho ADMIN, Customer cho ADMIN/SALES_STAFF. Các màn nghiệp vụ chưa có API chỉ hiện thông báo chưa kết nối; chế độ demo vẫn tách riêng.
- H2/H4/H5/M3/M4: xử lý token của user đã xóa thành 401, thêm unique phone cho customer active bằng V3 và trả 409 khi trùng, bootstrap admin khi DB rỗng qua biến môi trường, map lỗi toàn vẹn dữ liệu thành 409, chỉ công khai Product/BottleType active.
- H1/M2: thêm 3 kiểm tra PostgreSQL/Flyway/JPA/constraint khi có `DB_URL`; CI/CD chạy `npm test` thật. Tài liệu contract suy ra từ source ở `docs/SPRINT1_API_CONTRACT.md` và hướng dẫn preflight migration trong README.

Kiểm tra lại tại máy này: `mvn -B -ntp clean verify` **PASS** (124 tests, 0 failures/errors, **3 skipped** do không có `DB_URL`/PostgreSQL), jar đã tạo. `npm run lint`, `npm run typecheck`, `npm test` và `npm run build` đều **PASS**; test frontend hiện vẫn là test logic demo/mock, chưa phải E2E với backend. Build còn cảnh báo chunk báo cáo lớn. Không chạy migration, không có bằng chứng CI trên GitHub hoặc FE–BE HTTP E2E trên PostgreSQL. V2 trên DB cũ vẫn cần preflight dữ liệu trùng; N+1 Order và rủi ro localStorage vẫn là việc sau Sprint 1.

**Kết luận sau sửa: NOT READY TO MERGE** cho đến khi CI PostgreSQL/Java 21/Node 22 pass, kiểm thử login → CRUD → reload trên stack thật, rà dữ liệu trước V2/V3 và chốt contract/ERD với nhóm.
