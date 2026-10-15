## Mô tả

<!-- Mô tả ngắn gọn chức năng hoặc lỗi đã xử lý. -->

## Issue liên quan

Closes #

## Loại thay đổi

- [ ] `feat` – chức năng mới
- [ ] `fix` – sửa lỗi
- [ ] `refactor` – refactor
- [ ] `test` – test
- [ ] `docs` – tài liệu
- [ ] `chore/build` – cấu hình hoặc build

## Phạm vi ảnh hưởng

- [ ] Backend
- [ ] Frontend
- [ ] Database / Flyway migration
- [ ] API contract
- [ ] Tài liệu

## Checklist trước khi review

- [ ] Branch được tạo từ `develop` và không push trực tiếp vào branch chính.
- [ ] Commit tuân thủ Conventional Commits.
- [ ] Đã chạy `git diff --check`.
- [ ] Backend test/build pass nếu có ảnh hưởng backend.
- [ ] Frontend build pass nếu có ảnh hưởng frontend.
- [ ] Đã kiểm tra các luồng chính và xử lý Loading/Error/Empty phù hợp.
- [ ] Đã cập nhật API/OpenAPI nếu contract thay đổi.
- [ ] Đã tạo Flyway migration nếu schema thay đổi.
- [ ] Không có password, token, API key, `.env`, log hoặc file build trong PR.
- [ ] Đã cập nhật tài liệu liên quan.

## Cách kiểm thử

<!-- Ghi command, dữ liệu test và kết quả mong đợi. -->

## Ảnh giao diện

<!-- Bắt buộc nếu PR thay đổi UI. Xóa phần này nếu không áp dụng. -->
