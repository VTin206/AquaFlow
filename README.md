# AquaFlow – Water Agency Management System

AquaFlow là hệ thống quản lý đại lý nước tinh khiết cho một cửa hàng có một kho hàng.

## Công nghệ

- Backend: Java 21, Spring Boot 3.5.x, Spring Data JPA, Flyway, PostgreSQL
- Frontend: React, TypeScript, Vite
- API: RESTful JSON
- Authentication: Spring Security/JWT (đã chuẩn bị dependency, triển khai ở giai đoạn sau)

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
APP_JWT_SECRET=change-me-in-production
```

## Quy ước phát triển

- Mỗi module sở hữu domain, application service và adapter REST của mình.
- Không truy cập trực tiếp repository của module khác; giao tiếp qua application service/DTO.
- Database schema được thay đổi bằng Flyway migration, không sửa schema thủ công.
- Mỗi pull request cần có test phù hợp và mô tả rõ phạm vi thay đổi.

Xem thêm [docs/architecture.md](docs/architecture.md) và [docs/team-plan.md](docs/team-plan.md).
