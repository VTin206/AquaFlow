# AquaFlow – Quy tắc cho Agent và cộng tác viên

File này bổ sung hướng dẫn nhanh cho AI agent và thành viên làm việc trong repository. Quy tắc đầy đủ nằm ở [docs/team-rules.md](docs/team-rules.md); yêu cầu mới được chủ repository chấp thuận trong cuộc trao đổi hiện tại được áp dụng cho task tương ứng.

## 1. Trước khi bắt đầu

- Đọc `docs/team-rules.md` và tài liệu liên quan đến module đang làm.
- Kiểm tra `git status`, branch hiện tại và diff trước khi sửa.
- Bảo toàn mọi thay đổi có sẵn trong working tree; không reset, clean, checkout, stash hoặc ghi đè khi chưa được yêu cầu.
- Xác định rõ phạm vi task, API contract, migration và test cần ảnh hưởng.
- Không dùng production database hoặc database runtime chung để kiểm thử.

## 2. Branch và phạm vi thay đổi

- Không làm việc trực tiếp trên `main`.
- Được phép làm việc trực tiếp trên `develop` khi chủ repository yêu cầu hoặc chấp thuận rõ ràng. Trước khi sửa phải kiểm tra working tree và không ghi đè thay đổi chưa commit.
- Tạo branch riêng từ `develop` mới nhất, đặt tên theo dạng:
  `feat/...`, `fix/...`, `refactor/...`, `test/...`, `docs/...` hoặc `chore/...`.
- Một branch chỉ phục vụ một task hoặc một PR có liên quan trực tiếp.
- Không tự ý sửa module của thành viên khác, API contract, schema hoặc migration cũ nếu chưa trao đổi.
- Mọi thay đổi database phải dùng Flyway migration mới; không sửa migration đã áp dụng.
- Không commit file `.env`, password, token, API key, dữ liệu cá nhân hoặc secret.

## 3. Quy tắc code và kiểm thử

- Backend tuân thủ Controller – Service – Repository, dùng DTO, validation, authorization và transaction phù hợp.
- Frontend dùng React + TypeScript, gọi API qua lớp service, có loading/error/empty state khi phù hợp.
- Không đánh dấu chức năng hoàn thành chỉ vì đã có DTO, interface, mock hoặc giao diện.
- Mọi thay đổi nghiệp vụ phải có test tương ứng.
- Trước khi tạo PR, chạy các kiểm tra phù hợp và ghi rõ PASS/FAIL/SKIP:
  - `git diff --check`
  - Backend compile/test/integration test nếu có
  - Frontend lint/typecheck/build nếu có
  - Migration trên database test độc lập nếu thay đổi schema
- Không xóa test, giảm assertion hoặc bỏ qua lỗi chỉ để làm CI xanh.

## 4. Quy tắc commit

Commit dùng Conventional Commits:

```text
type(scope): description
```

`description` viết ngắn gọn bằng tiếng Anh, ở dạng mệnh lệnh, không có dấu chấm cuối câu.

Các type hợp lệ:

- `feat`: thêm chức năng
- `fix`: sửa lỗi
- `refactor`: đổi cấu trúc, không đổi nghiệp vụ
- `test`: thêm hoặc sửa test
- `docs`: cập nhật tài liệu
- `chore`: cấu hình hoặc bảo trì
- `build`: thay đổi build/dependency

Ví dụ:

```text
feat(order): add counter order validation
fix(inventory): prevent duplicate dispatch
test(delivery): cover failed handover
docs(api): update dispatch contract
```

Trước khi commit:

1. Chạy `git status` và kiểm tra từng file trong diff.
2. Chỉ stage file thuộc task; không dùng `git add .` nếu working tree có thay đổi không liên quan.
3. Chạy `git diff --check` và test cần thiết.
4. Không commit code lỗi mà không ghi rõ trạng thái trong PR/Issue.
5. Không dùng message chung chung như `update`, `fix bug`, `done`, `final` hoặc `code`.
6. Không sửa lịch sử bằng force push trên `main` hoặc `develop`.

Quy trình mẫu:

```bash
git status
git diff --check
git add <file-thuoc-task>
git commit -m "fix(order): validate counter handover"
git push -u origin <branch>
```

## 5. Pull Request và hoàn thành task

- Thay đổi lớn hoặc ảnh hưởng nhiều module vẫn nên đi qua Pull Request vào `develop`; thay đổi trực tiếp trên `develop` phải được kiểm thử và ghi lại bằng commit rõ ràng.
- PR phải nêu mục tiêu, phạm vi, file/module ảnh hưởng, API hoặc migration thay đổi, cách kiểm thử và giới hạn còn lại.
- Không merge PR chưa được review; ưu tiên ít nhất một reviewer khác tác giả.
- Chỉ coi task là Done khi code đã được review, test, tích hợp vào `develop` và kiểm tra trên phiên bản tích hợp.
- Sau khi merge và xác nhận không còn công việc dùng branch, mới dọn branch theo quy định nhóm.

## 6. An toàn dữ liệu

- Không dùng lệnh phá hủy trên workspace hoặc database khi chưa xác định chính xác mục tiêu.
- Không chạy migration trên database thật.
- Không tự ý commit, push, merge hoặc tạo PR nếu task chỉ yêu cầu audit/phân tích.
- Khi phát hiện blocker hoặc thay đổi ngoài phạm vi, dừng tại đó và báo rõ bằng chứng, ảnh hưởng và đề xuất xử lý.
