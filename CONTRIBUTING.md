# Quy tắc đóng góp AquaFlow

Tài liệu này là quy tắc làm việc chung của nhóm AquaFlow. Mọi thành viên cần đọc và tuân thủ trước khi bắt đầu phát triển.

Chi tiết đầy đủ xem tại [docs/team-rules.md](docs/team-rules.md).

## Quy trình nhanh

1. Tạo hoặc nhận một GitHub Issue có người phụ trách, mô tả, tiêu chí hoàn thành, deadline và module.
2. Cập nhật `develop`, sau đó tạo một branch riêng cho đúng task.
3. Phát triển, tự kiểm tra và commit bằng Conventional Commits.
4. Push branch và mở Pull Request vào `develop`.
5. Cập nhật Issue, xử lý review comments và chỉ merge sau khi có ít nhất một người khác review.
6. Chỉ maintainer merge code đã được review; ưu tiên **Squash and merge**.
7. Sau khi merge và kiểm tra tích hợp thành công, xóa branch nguồn trên GitHub và branch local.

Luồng chuẩn:

```text
feature/fix branch → PR vào develop → kiểm thử tích hợp → release vào main
```

Không tạo branch mới từ một branch feature cũ đã hoàn thành. Nếu cần tiếp tục
công việc, hãy tạo branch mới từ `develop` để tránh lịch sử branch bị chồng
chéo và khó theo dõi.

## Các nguyên tắc bắt buộc

- Không push trực tiếp vào `main` hoặc `develop`.
- Không merge PR chưa được review.
- Không commit password, token, API key hoặc file `.env`.
- Mọi thay đổi schema phải có Flyway migration tương ứng.
- Khi thay đổi API hoặc database, phải thông báo thành viên liên quan và cập nhật tài liệu.
- Trước khi tạo PR, backend/frontend phải build thành công và chức năng đã được tự kiểm tra.
