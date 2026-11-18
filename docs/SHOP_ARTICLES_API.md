# Bài viết trang khách (tin tức và chính sách)

Migration: `V31__shop_articles.sql`. Trước đây 5 bài tin và 4 trang chính sách viết cứng trong FE (`shopNews.ts`);
migration nạp sẵn đúng nội dung đó (đã đăng) nên trang khách không đổi sau khi nâng cấp.

## 1. Trang khách (không cần đăng nhập)

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/v1/shop-articles?kind=NEWS\|POLICY` | Bài đã đăng. Tin: ngày đăng mới nhất trước. Chính sách: theo thứ tự thêm (thứ tự ở chân trang). `body` là `null`. |
| GET | `/api/v1/shop-articles/{slug}` | Một bài đã đăng, có `body`. Bản nháp hoặc không có thì 404. |

Response: `{ kind, slug, title, summary, icon, publishedOn, body }`. Không có `id`, trạng thái, phiên bản.

FE mở tin ở `/shop/news/{slug}`, chính sách ở `/shop/policy/{slug}`; mở sai loại thì hiện "Không tìm thấy bài viết".

## 2. Quản lý (chỉ ADMIN)

Theo quy tắc chung `/api/v1/admin/**`: chưa đăng nhập 401, vai trò khác 403. Trang FE: `/articles` (menu Quản lý › Bài viết).

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/v1/admin/shop-articles` | Tất cả bài, cả bản nháp: tin trước chính sách, trong mỗi loại bài sửa gần nhất trước. |
| POST | `/api/v1/admin/shop-articles` | Thêm → 201. |
| PUT | `/api/v1/admin/shop-articles/{id}` | Sửa, đăng hoặc ẩn → 200. |
| DELETE | `/api/v1/admin/shop-articles/{id}` | Xóa hẳn → 204. Muốn giữ để đăng lại sau thì sửa `published=false`. |

Request:

```json
{
  "kind": "NEWS | POLICY",
  "slug": "khuyen-mai-thang-12",
  "title": "...",
  "summary": "...",
  "icon": "gift",
  "body": "Đoạn 1\n## Tiêu đề nhỏ\nĐoạn 2",
  "published": true,
  "publishedOn": "2026-12-01",
  "version": 3
}
```

- `kind` bắt buộc khi thêm; khi sửa bị bỏ qua (không đổi loại bài đã có).
- `slug` để trống thì tự sinh từ tiêu đề: bỏ dấu tiếng Việt (`đ` → `d`), nối bằng `-`, tối đa 116 ký tự; trùng thì thêm
  `-2`, `-3`... Tự nhập thì chỉ gồm `a-z`, `0-9` và `-` giữa các từ (400), không trùng bài khác ở cả hai loại (409).
- `title` ≤ 200, `summary` ≤ 300, `body` ≤ 20000 ký tự, không để trống (400). Tiêu đề và tóm tắt được gộp khoảng trắng
  thừa; nội dung bỏ khoảng trắng cuối dòng và chỉ giữ tối đa một dòng trống liền nhau.
- `body`: mỗi dòng là một đoạn; dòng bắt đầu bằng `## ` là tiêu đề nhỏ.
- `icon` thuộc danh sách cố định: `newspaper, megaphone, gift, glass-water, droplets, thermometer-sun, recycle,
  calendar-clock, truck, rotate-ccw, wallet, shield-check` (khác thì 400). Thêm icon phải sửa cả
  `ShopArticleService.ICONS` và `frontend/src/features/articles/articleIcons.ts`.
- `publishedOn` chỉ dùng cho tin. Tin được đăng mà để trống thì lấy ngày hôm nay theo giờ Việt Nam; ẩn bài vẫn giữ ngày.
  Chính sách luôn `null`.
- `version` bắt buộc khi sửa (400 nếu thiếu): gửi lại `version` đã đọc. Người khác đã lưu trước thì 409, FE tải lại danh
  sách và giữ form để sửa lại.

Response: `{ id, kind, slug, title, summary, icon, body, published, publishedOn, createdAt, updatedAt, version }`.

## 3. Nhật ký

Thêm / sửa / xóa được ghi nhật ký với `entityType=SHOP_ARTICLE`, khu vực `SETTINGS` (bộ lọc "Cài đặt" ở trang Nhật ký).
