# AquaFlow – CI/CD

## Phạm vi hiện tại

AquaFlow hiện triển khai **Continuous Integration** và **Continuous Delivery**:

- CI tự động lint, typecheck, test và build trên Pull Request vào `develop`/`main`, hoặc push vào `develop`/`main`.
- CD tự động kiểm tra lại code và build/publish hai Docker images lên GitHub Container Registry khi push vào `main`.
- Chưa triển khai Continuous Deployment vì dự án chưa chọn hosting chính thức.

## CI workflow

File: `.github/workflows/ci.yml`

Backend và frontend chạy song song.

### Backend

- Java 21 Temurin.
- Maven cache qua `actions/setup-java`.
- PostgreSQL 16 service container dành riêng cho test.
- `mvn dependency:go-offline`.
- `mvn clean verify`, bao gồm compile, unit/integration tests nếu có và package Spring Boot.
- Biến môi trường database chỉ dùng cho CI test.

### Frontend

- Node.js 22.x.
- npm cache qua `actions/setup-node`.
- `npm ci`.
- `npm run lint`.
- `npm run typecheck`.
- `npm run build`.
- `npm run test --if-present` để tự chạy khi test script được bổ sung.

CI không merge PR, không push code và không tự sửa source code.

## CD workflow

File: `.github/workflows/cd.yml`

CD chỉ chạy khi:

- Có push vào `main` (bao gồm merge PR vào `main`).
- Được kích hoạt thủ công bằng `workflow_dispatch`.

Workflow sẽ validate lại backend/frontend trước khi publish. Sau đó hai image được build và push song song:

```text
ghcr.io/vtin206/aquaflow-backend:sha-<commit-sha>
ghcr.io/vtin206/aquaflow-backend:latest
ghcr.io/vtin206/aquaflow-frontend:sha-<commit-sha>
ghcr.io/vtin206/aquaflow-frontend:latest
```

Owner được lấy từ repository context và chuyển thành chữ thường để phù hợp GHCR. Workflow dùng `GITHUB_TOKEN`, không lưu token trong source.

## Build Docker local

Docker Desktop cần đang chạy:

```bash
docker build -t aquaflow-backend:local ./backend
docker build -t aquaflow-frontend:local ./frontend
```

Frontend image dùng Nginx, hỗ trợ SPA fallback và proxy `/api/` tới hostname `backend` trên Docker network.

File `docker-compose.prod.yml` là mẫu chạy production-like stack. Tạo file biến môi trường ngoài repository rồi chạy:

```bash
cp .env.prod.example .env.prod
# sửa .env.prod bằng credentials thật ở máy/secret manager, không commit file này
docker compose --env-file .env.prod -f docker-compose.prod.yml pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

Compose yêu cầu `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` và `APP_JWT_SECRET`; không có credentials production trong repository.

## GitHub Rulesets / Branch Protection

Chưa tự động thay đổi repository settings. Sau khi các workflow chạy thành công ít nhất một lần, cấu hình thủ công tại **Settings → Rules → Rulesets**:

### `main`

- Target branch: `main`.
- Require a pull request before merging.
- Required approvals: ít nhất 1.
- Require status checks to pass before merging: chọn `Backend - verify` và `Frontend - lint, typecheck and build` từ `AquaFlow CI`.
- Block force pushes.
- Block branch deletion.

### `develop`

- Target branch: `develop`.
- Require a pull request before merging.
- Require status checks to pass: `Backend - verify` và `Frontend - lint, typecheck and build`.
- Block force pushes.

**Lưu ý:** Không bật required checks trước khi chúng xuất hiện trong danh sách status checks của GitHub.

## Cách kiểm tra trên GitHub

1. Push branch có thay đổi vào GitHub hoặc mở PR vào `develop`.
2. Mở tab **Actions** và chọn workflow **AquaFlow CI**.
3. Xác nhận hai jobs `Backend - verify` và `Frontend - lint, typecheck and build` đều màu xanh.
4. Merge vào `main` sau khi PR được review.
5. Kiểm tra workflow **AquaFlow CD** và phần **Packages** của repository để xem hai image GHCR.

## Hướng mở rộng Continuous Deployment

Khi nhóm chọn hosting, tạo workflow deploy riêng chạy sau publish image thành công. Credentials phải lưu trong GitHub Environments/Secrets; nên dùng environment approval, health check, rollback theo image tag SHA và không deploy production trực tiếp từ feature branch.
