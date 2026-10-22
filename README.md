# AquaFlow – Water Agency Management System

AquaFlow là hệ thống quản lý đại lý nước tinh khiết cho một cửa hàng có một kho hàng.

## Công nghệ

- Backend: Java 21, Spring Boot 3.5.x, Spring Data JPA, Flyway, PostgreSQL
- Frontend: React, TypeScript, Vite
- API: RESTful JSON
- Authentication: Spring Security/JWT; tài khoản được cấp từ PostgreSQL.

## Cấu trúc repository

```text
aquaflow/
├── backend/                 # Spring Boot modular monolith
│   └── src/main/java/com/aquaflow/
│       ├── shared/           # Thành phần dùng chung
│       ├── auth/             # Authentication & User Management
│       ├── inventory/        # Product, Supplier & Inventory
│       ├── customer/         # Customer & Order
│       └── delivery/         # Delivery & Bottle Management
├── frontend/                # React + TypeScript + Vite
├── database/                # Script hỗ trợ PostgreSQL local
├── docs/                    # Kiến trúc, API và phân công nhóm
└── docker-compose.yml
```

## Chạy local

### 1. Khởi động PostgreSQL

```bash
docker compose up -d postgres
```

Database mặc định:

- Host: `localhost`
- Port: `5432`
- Database: `aquaflow`
- User: `aquaflow`
- Password: `aquaflow`

### 2. Chạy backend

Trước lần chạy đầu tiên, đặt `APP_JWT_SECRET` là chuỗi ngẫu nhiên ít nhất 32 ký tự. Để tạo tài khoản quản trị đầu tiên trên database trống, đặt thêm `APP_BOOTSTRAP_ADMIN_EMAIL`, `APP_BOOTSTRAP_ADMIN_PASSWORD` (ít nhất 12 ký tự), và tùy chọn `APP_BOOTSTRAP_ADMIN_NAME`. Chỉ dùng các biến bootstrap trong lần cấp tài khoản đầu; xóa chúng khỏi môi trường sau đó. Nếu DB đã có user, bootstrap không tạo thêm tài khoản.

Migration V2 yêu cầu mỗi khách chỉ có tối đa một địa chỉ mặc định; V3 yêu cầu không có hai khách hàng đang hoạt động cùng số điện thoại (kể cả cùng số viết dưới dạng `0...` và `+84...`). Trước khi nâng cấp DB đã có dữ liệu, kiểm tra và xử lý bản ghi trùng bằng quy trình nghiệp vụ; không tự xóa dữ liệu. CI chạy migration trên PostgreSQL trống.

```sql
-- Trên schema V1, trước khi áp V2:
SELECT customer_id, COUNT(*) FROM customer_addresses WHERE is_default = TRUE GROUP BY customer_id HAVING COUNT(*) > 1;
-- Trên schema V2, trước khi áp V3:
SELECT CASE WHEN phone LIKE '+84%' THEN '0' || SUBSTRING(phone FROM 4) ELSE phone END AS normalized_phone, COUNT(*)
FROM customers WHERE active = TRUE AND phone IS NOT NULL
GROUP BY normalized_phone HAVING COUNT(*) > 1;
```

```bash
cd backend
mvn spring-boot:run
```

Backend chạy tại `http://localhost:8080`.

Kiểm tra:

```bash
curl http://localhost:8080/api/v1/health
```

### 3. Chạy frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy tại `http://localhost:5173`.

## Profiles và biến môi trường

Profile mặc định là `local`. Có thể ghi đè bằng các biến:

```text
SPRING_PROFILES_ACTIVE=local
DB_URL=jdbc:postgresql://localhost:5432/aquaflow
DB_USERNAME=aquaflow
DB_PASSWORD=aquaflow
APP_JWT_SECRET=<random-secret-at-least-32-characters>
APP_BOOTSTRAP_ADMIN_EMAIL=<first-admin-email>
APP_BOOTSTRAP_ADMIN_PASSWORD=<first-admin-password-at-least-12-characters>
APP_BOOTSTRAP_ADMIN_NAME=Administrator
```

## Quy ước phát triển

- Mỗi module sở hữu domain, application service và adapter REST của mình.
- Không truy cập trực tiếp repository của module khác; giao tiếp qua application service/DTO.
- Database schema được thay đổi bằng Flyway migration, không sửa schema thủ công.
- Mỗi pull request cần có test phù hợp và mô tả rõ phạm vi thay đổi.

Xem thêm [docs/architecture.md](docs/architecture.md), [docs/team-plan.md](docs/team-plan.md), [CONTRIBUTING.md](CONTRIBUTING.md) và [docs/team-rules.md](docs/team-rules.md).

Xem hướng dẫn CI/CD tại [docs/CICD.md](docs/CICD.md).

Compose production mẫu: `docker-compose.prod.yml` (dùng `.env.prod` bên ngoài Git).
