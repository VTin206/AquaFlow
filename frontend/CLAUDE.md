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

- React + TypeScript + Vite + **Ant Design 6** (UI) + **React Query** (dữ liệu). Chạy dev: `npm run dev` (http://localhost:5173, `/api` proxy sang `http://localhost:8080`).
- Cấu trúc `src/` theo tính năng:
  - `app/`: `App.tsx` (routes), `providers.tsx`, `theme.ts` (màu, font, token Ant Design), `navigation.ts` (menu).
  - `layouts/`: khung app (sidebar, drawer trên điện thoại).
  - `features/<tên>/`: mỗi tính năng tự chứa trang, `components/`, `types.ts`, service (`*Service.ts`) và hook React Query (`use*.ts`). Hiện có `orders`, `inventory` (kho + sản phẩm), `customers`, `delivery`, `dashboard`, `reports`.
  - `shared/`: dùng chung giữa các tính năng — `api/client.ts` (gọi API), `components/` (`Page`, `QueryError`, `BarChart`), `utils/format.ts`.
  - `mocks/`: dữ liệu mẫu trong bộ nhớ; service gọi `mockRequest()` cho tới khi backend có API.
  - `styles/global.css`: chỉ bố cục mà Ant Design không có; class tự đặt dùng tiền tố `af-`.
- Dùng component Ant Design trước khi tự viết. Đổi màu/font ở `app/theme.ts`, không ghi đè style component bằng CSS.
- Mọi lệnh gọi backend nằm trong `features/*/…Service.ts` qua `shared/api/client.ts`; component chỉ dùng hook. Không gọi `fetch` trực tiếp.
- Thông báo dùng `App.useApp().message`; form dùng `Form` với `rules` để kiểm tra ngay khi nhập.
- Component `PascalCase`, biến/hàm `camelCase`. Không hardcode địa chỉ API. UI có trạng thái Loading/Error/Empty khi phù hợp.
