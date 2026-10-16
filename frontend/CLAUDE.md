# AquaFlow Frontend – hướng dẫn cho Claude Code

Áp dụng cho code trong `frontend/`. Quy tắc đầy đủ của nhóm: [../docs/team-rules.md](../docs/team-rules.md).

## Branch

- Không bao giờ commit/push trực tiếp lên `main` hoặc `develop`.
- Trước khi sửa code, kiểm tra branch hiện tại. Nếu đang ở `main`/`develop`, tạo branch mới từ `develop` mới nhất:
  `git switch develop && git pull origin develop && git switch -c <type>/fe-<ten-viec>`
- Mỗi task (một Issue) một branch. Không làm task khác trên branch đang có thay đổi chưa liên quan.
- Tên branch: `feat/fe-...`, `fix/fe-...`, `refactor/fe-...`, `docs/fe-...`, `chore/fe-...`, `build/fe-...`.
- Chỉ sửa file trong `frontend/`. Cần đổi backend, database hoặc API contract thì báo người dùng thay vì tự sửa.

## Khi nào commit

Commit sau mỗi bước nhỏ có ý nghĩa và đã kiểm tra, không đợi xong cả task:

1. Thay đổi mô tả được bằng một câu ngắn (ví dụ "add product edit modal").
2. Đã chạy và pass (trong `frontend/`): `npm run lint` và `npm run typecheck`. Thay đổi lớn thì chạy thêm `npm run build`.
3. `git status` / `git diff` không có file ngoài phạm vi, không có `.env`, `dist/`, `node_modules/`.

Message theo Conventional Commits, mô tả tiếng Anh, dạng mệnh lệnh, không dấu chấm cuối:
`feat(ui): add product edit modal`, `fix(ui): reset search when switching page`, `refactor(ui): extract Modal component`.

Không gộp nhiều việc không liên quan vào một commit. Không commit code đang lỗi build.

## Khi nào push

- Push branch tính năng ngay sau khi commit (`git push`, lần đầu `git push -u origin <branch>`) để có bản sao lưu và nhóm theo dõi được tiến độ.
- Không dùng `git push --force` trên branch dùng chung; không bao giờ force push `main`/`develop`.

## Pull Request

- Khi task đạt tiêu chí của Issue: hỏi người dùng trước, rồi mới tạo PR vào `develop` (không phải `main`).
- PR cần: liên kết Issue, mô tả thay đổi, file ảnh hưởng, cách kiểm tra, ảnh chụp giao diện.
- Reviewer là Frontend Developer còn lại. Không tự merge PR; merge do maintainer thực hiện (Squash and merge).

## Dự án

- React + TypeScript + Vite. Chạy dev: `npm run dev` (http://localhost:5173, `/api` proxy sang `http://localhost:8080`).
- Cấu trúc `src/`: `pages/` (mỗi trang một file), `components/` (dùng chung), `types/`, `mocks/`, `config/`, `utils/`. Gọi API tập trung trong `services/`, không gọi `fetch` rải rác trong component.
- Component `PascalCase`, biến/hàm `camelCase`. Không hardcode địa chỉ API. UI có trạng thái Loading/Error/Empty khi phù hợp.
