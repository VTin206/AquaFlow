# AquaFlow – Kiến trúc ban đầu

## Modular Monolith

Backend được đóng gói thành một ứng dụng Spring Boot duy nhất, nhưng domain được chia theo module. Mỗi module có thể phát triển và kiểm thử độc lập trong cùng một repository.

```text
com.aquaflow
├── shared       # API error, security, cấu hình dùng chung
├── auth         # User, role, login, JWT
├── inventory    # Product, Supplier, Inventory
├── customer     # Customer, Order, OrderItem
└── delivery     # Delivery, BottleTransaction
```

## Quy tắc phụ thuộc

1. `shared` không phụ thuộc vào các module nghiệp vụ.
2. Module nghiệp vụ không truy cập trực tiếp database repository của module khác.
3. REST controller chỉ gọi application service; không chứa nghiệp vụ phức tạp.
4. DTO được dùng ở ranh giới module và ranh giới API.
5. Các thay đổi schema bắt buộc đi qua Flyway migration.

## Luồng dữ liệu dự kiến

```text
React UI → REST Controller → Application Service → Domain → Repository → PostgreSQL
                                     ↓
                              Domain Event (sau)
```

JWT đã có dependency và khung Spring Security. Ở giai đoạn đầu, các endpoint được mở để nhóm tập trung hoàn thiện domain; khi làm Authentication sẽ thay `permitAll()` bằng JWT filter và phân quyền theo role.
