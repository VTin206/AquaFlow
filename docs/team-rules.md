# AquaFlow – Quy tắc làm việc nhóm và GitHub

**Phạm vi:** áp dụng cho cả 3 Backend Developers và 2 Frontend Developers.

## 1. Nguyên tắc làm việc nhóm

1. Mỗi thành viên chịu trách nhiệm với chức năng/module được phân công.
2. Không tự ý sửa code thuộc module của người khác nếu chưa trao đổi.
3. Mọi công việc phải được quản lý bằng GitHub Issues và GitHub Projects.
4. Không code trực tiếp trên `main` hoặc `develop`.
5. Mọi thay đổi phải đi qua Pull Request.
6. Code phải build và được kiểm tra trước khi tạo PR.
7. Khi thay đổi API hoặc database, phải thông báo cho các thành viên liên quan.
8. Không tự ý xóa, đổi tên hoặc thay đổi cấu trúc chung của dự án.
9. Không commit thông tin nhạy cảm như password, token, API key hoặc file `.env`.
10. Khi gặp khó khăn hoặc có nguy cơ trễ deadline, phải báo sớm cho nhóm.

Người phụ trách module chịu trách nhiệm về API, code, validation, test và tài liệu liên quan đến phần được giao.

## 2. GitHub Issues và Projects

Mỗi Issue cần có:

- Tên công việc rõ ràng.
- Người phụ trách.
- Mô tả và phạm vi công việc.
- Tiêu chí hoàn thành (Acceptance Criteria).
- Deadline nội bộ.
- Module liên quan.

Trạng thái chuẩn:

- **Todo:** chưa bắt đầu.
- **In Progress:** đang thực hiện.
- **In Review:** đã tạo PR, đang review.
- **Done:** PR đã merge và hoàn tất kiểm tra tích hợp.
- **Blocked:** đang bị chặn bởi vấn đề khác.

Không đánh dấu `Done` khi mới chỉ code xong nhưng chưa tích hợp hoặc chưa kiểm thử theo yêu cầu.

## 3. Branch strategy

Hai branch chính:

- `main`: phiên bản ổn định, dùng để demo/phát hành.
- `develop`: branch tích hợp các chức năng đã được review.

Luồng làm việc chuẩn:

```text
feature/fix branch → Pull Request → develop → kiểm thử tích hợp → main
```

`develop` là branch mặc định để nhận các tính năng mới. `main` chỉ nhận
những thay đổi đã ổn định từ `develop` thông qua quy trình release hoặc PR
được maintainer phê duyệt. Không tạo branch công việc mới trực tiếp từ
`main`, trừ khi maintainer yêu cầu để xử lý hotfix.

Mỗi công việc phải tạo branch riêng từ `develop`:

```text
feat/be-ten-chuc-nang
feat/fe-ten-chuc-nang
fix/be-ten-loi
fix/fe-ten-loi
refactor/ten-module
docs/ten-tai-lieu
chore/ten-cong-viec
test/ten-module
```

Ví dụ hợp lệ:

```text
feat/be-auth-login
feat/be-inventory-import
feat/be-order-create
feat/fe-login-page
feat/fe-product-list
fix/be-order-stock
docs/update-erd
```

Không dùng tên chung chung như `test`, `code-moi`, `branch1`, `update`, `final`.

Khởi tạo branch:

```bash
git fetch origin
git switch develop
git pull --ff-only origin develop
git switch -c feat/be-auth-login
```

Trước khi bắt đầu task mới, phải cập nhật branch từ `develop`. Trong thời
gian làm việc, nếu `develop` có thay đổi ảnh hưởng đến task thì cần đồng bộ
lại branch cá nhân trước khi tạo PR.

Branch cá nhân chỉ phục vụ cho một task hoặc một PR. Không dùng một branch
cho nhiều chức năng không liên quan và không tạo các branch trùng mục đích
chỉ vì đổi tên giao diện hoặc thay đổi nhỏ.

Sau khi PR đã được merge:

1. Cập nhật Issue/Project sang `Done` sau khi kiểm tra tích hợp thành công.
2. Xóa branch nguồn trên GitHub nếu không còn PR hoặc công việc nào sử dụng.
3. Xóa branch local tương ứng và chạy `git fetch --prune` để dọn các remote-tracking branch đã không còn tồn tại.

Không xóa branch nếu PR chưa được merge, còn commit chưa được tích hợp hoặc
còn thành viên đang sử dụng branch đó. Không dùng `git push --force` trên
`main` hoặc `develop`.

Ví dụ dọn branch sau khi merge:

```bash
git switch develop
git pull --ff-only origin develop
git branch -d feat/be-auth-login
git push origin --delete feat/be-auth-login
git fetch --prune
```

## 4. Quy tắc commit

Tất cả commit sử dụng Conventional Commits:

```text
type(scope): description
```

`description` viết bằng tiếng Anh, ngắn gọn, ở dạng mệnh lệnh và không kết thúc bằng dấu chấm.

Các `type` được sử dụng:

- `feat`: thêm chức năng.
- `fix`: sửa lỗi.
- `refactor`: thay đổi cấu trúc nhưng không đổi hành vi.
- `test`: thêm hoặc sửa test.
- `docs`: cập nhật tài liệu.
- `chore`: công việc cấu hình/bảo trì.
- `build`: thay đổi build/dependency.

Ví dụ:

```text
feat(auth): implement login endpoint
feat(product): add product CRUD API
feat(inventory): implement stock reservation
feat(order): implement order confirmation
feat(delivery): add delivery trip management
feat(ui): implement login page
fix(order): prevent negative inventory
refactor(payment): simplify payment validation
docs(database): update ERD
test(auth): add login integration tests
```

Quy tắc commit:

1. Một commit đại diện cho một thay đổi có ý nghĩa.
2. Không gộp nhiều chức năng không liên quan vào cùng commit.
3. Không commit code đang lỗi mà không ghi rõ mục đích và trạng thái trong PR/Issue.
4. Không commit thư mục build, log hoặc dependencies được tạo tự động.
5. Kiểm tra `git status` và các file thay đổi trước khi commit.
6. Không dùng message chung chung như `update`, `fix bug`, `code`, `done`, `abc`, `final`.

Ví dụ quy trình:

```bash
git status
git diff --check
git add backend/src/main/java/com/aquaflow/auth
git commit -m "feat(auth): implement login endpoint"
git push -u origin feat/be-auth-login
```

## 5. Pull Request và review

Mọi thay đổi được đưa vào `develop` thông qua PR. PR phải dùng đúng branch
đích và không được mở nhiều PR khác nhau cho cùng một thay đổi. PR vào
`main` chỉ dành cho release hoặc hotfix đã được maintainer thống nhất.

PR phải:

- Liên kết với GitHub Issue.
- Mô tả chức năng đã thực hiện.
- Liệt kê file/module bị ảnh hưởng.
- Nêu rõ API hoặc database có thay đổi hay không.
- Ghi cách kiểm tra chức năng.
- Đính kèm ảnh giao diện nếu là frontend.
- Có ít nhất một thành viên khác review.
- Không được tự approve PR của chính mình.

Ưu tiên reviewer:

- Backend PR: review bởi một Backend Developer khác.
- Frontend PR: review bởi một Frontend Developer khác.
- Thay đổi ảnh hưởng cả FE và BE: cần trao đổi/review giữa hai nhóm.

PR chỉ được merge khi các lỗi quan trọng đã được giải quyết. Ưu tiên **Squash and merge** để lịch sử `develop` gọn và dễ quản lý.

## 6. Definition of Done

Một chức năng chỉ được coi là hoàn thành khi:

- Đáp ứng yêu cầu nghiệp vụ và tiêu chí của Issue.
- Code tuân thủ quy ước chung.
- Backend/frontend build thành công.
- Đã thực hiện test cần thiết.
- API hoặc database đã cập nhật tài liệu nếu có thay đổi.
- Không còn lỗi nghiêm trọng đã biết trong phạm vi chức năng.
- PR đã được review và merge vào `develop`.
- Chức năng hoạt động trên phiên bản tích hợp.
- Branch nguồn đã được dọn sau khi xác nhận không còn công việc chưa tích hợp.

## 7. Quy tắc backend

1. Tuân thủ kiến trúc `Controller – Service – Repository`.
2. Không viết business logic trực tiếp trong Controller.
3. API sử dụng prefix `/api/v1`.
4. Sử dụng DTO cho request và response.
5. Không trả trực tiếp JPA Entity trong API nghiệp vụ.
6. Validate dữ liệu đầu vào.
7. Sử dụng Spring Security để phân quyền.
8. Dùng transaction cho nghiệp vụ liên quan nhiều bảng, đặc biệt là đơn hàng và tồn kho.
9. Ghi nhận các thay đổi quan trọng bằng audit log khi module hỗ trợ.
10. Viết test cho các nghiệp vụ quan trọng.

## 8. Quy tắc database

- PostgreSQL là database dùng chung.
- Schema được quản lý bằng Flyway Migration.
- Không tự sửa schema chung mà không tạo migration tương ứng.
- Không chỉnh sửa migration đã áp dụng trên môi trường dùng chung; tạo migration mới.
- Không dùng `ddl-auto=create` hoặc `create-drop` trên database dùng chung.
- Không xóa dữ liệu chung nếu chưa được cả nhóm thống nhất.
- Thay đổi khóa ngoại và quan hệ bảng phải được review.

## 9. Quy tắc frontend

1. Sử dụng React + TypeScript.
2. Component dùng `PascalCase`.
3. Biến và function dùng `camelCase`.
4. API tập trung ở service/API client, không gọi API tùy tiện trong từng component.
5. Tái sử dụng component chung.
6. Không hardcode địa chỉ API hoặc dữ liệu nhạy cảm.
7. UI cần có trạng thái Loading, Error và Empty khi phù hợp.
8. Có thể dùng mock data/mock API khi backend chưa cung cấp API.
9. Không tự thay đổi API contract.
10. Kiểm tra build và các luồng giao diện trước khi tạo PR.

## 10. API contract và phối hợp FE–BE

Trước khi code chức năng có kết nối API, hai bên phải thống nhất:

- Endpoint.
- HTTP method.
- Request DTO.
- Response DTO.
- HTTP status code.
- Validation.
- Phân quyền.
- Cách xử lý lỗi.

Nếu Backend thay đổi API, phải cập nhật Swagger/OpenAPI và thông báo Frontend. Frontend không tự suy đoán response mà phải dựa trên API contract đã thống nhất. Có thể dùng mock data/mock API để phát triển song song.

## 11. Giao tiếp và tiến độ

- Cập nhật tiến độ ít nhất 3 lần mỗi tuần.
- Khi hoàn thành task, cập nhật GitHub Issue và tạo PR.
- Khi gặp lỗi chặn tiến độ, thông báo trong nhóm và ghi rõ vấn đề.
- Báo nguy cơ trễ deadline càng sớm càng tốt, ưu tiên trước ít nhất 24 giờ.
- Không thay đổi công việc được phân công mà không trao đổi.
- Đặt deadline nội bộ sớm hơn deadline nộp đồ án.
- Mỗi tuần dành thời gian kiểm tra tích hợp FE–BE.

## 12. Năm điều không được vi phạm

1. **Không push trực tiếp vào `main`.**
2. **Không merge code chưa review.**
3. **Không tự ý sửa database dùng chung.**
4. **Không commit password, token hoặc file `.env`.**
5. **Không báo hoàn thành khi chưa kiểm thử và tích hợp.**
