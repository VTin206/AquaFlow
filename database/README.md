# Database

PostgreSQL được chạy bằng `docker-compose.yml` ở thư mục gốc. Schema khởi đầu nằm trong Flyway migration của backend tại:

`backend/src/main/resources/db/migration/V1__initial_schema.sql`

Không tạo schema thủ công trong môi trường ứng dụng; hãy thêm migration mới theo quy ước `V2__description.sql`, `V3__description.sql`, ...
