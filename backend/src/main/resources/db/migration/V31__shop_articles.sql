-- Bài viết trên trang khách: tin tức (NEWS) và trang chính sách ở chân trang (POLICY). Chủ cửa hàng tự viết, đăng và ẩn;
-- trước đây nội dung viết cứng trong frontend (shopNews.ts).
CREATE TABLE shop_articles (
    id BIGSERIAL PRIMARY KEY,
    kind VARCHAR(10) NOT NULL,
    -- Đường dẫn /shop/news/{slug} hoặc /shop/policy/{slug}; duy nhất trên cả hai loại để đổi loại không trùng link.
    slug VARCHAR(120) NOT NULL,
    title VARCHAR(200) NOT NULL,
    summary VARCHAR(300) NOT NULL,
    -- Khóa icon trong danh sách cố định của frontend (glass-water, recycle...).
    icon VARCHAR(40) NOT NULL,
    -- Mỗi dòng là một đoạn; dòng bắt đầu bằng "## " là tiêu đề nhỏ.
    body TEXT NOT NULL,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    -- Ngày hiện trên tin tức; chính sách không ghi ngày.
    published_on DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_shop_articles_kind CHECK (kind IN ('NEWS', 'POLICY')),
    CONSTRAINT chk_shop_articles_slug CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT chk_shop_articles_title CHECK (btrim(title) <> ''),
    CONSTRAINT chk_shop_articles_body CHECK (btrim(body) <> '')
);
CREATE UNIQUE INDEX uq_shop_articles_slug ON shop_articles (slug);
-- Trang khách chỉ đọc bài đã đăng theo loại.
CREATE INDEX idx_shop_articles_public ON shop_articles (kind, published_on DESC, id DESC) WHERE published;

-- Nội dung đang hiện trên trang khách, giữ nguyên thứ tự: tin mới nhất trước, chính sách theo thứ tự ở chân trang.
INSERT INTO shop_articles (kind, slug, title, summary, icon, body, published, published_on) VALUES
('NEWS', 'binh-up-hay-binh-voi', 'Bình úp hay bình vòi: chọn loại nào cho gia đình và văn phòng?',
 'Hai kiểu bình 19–20 lít phổ biến nhất, khác nhau ở cách dùng và thiết bị đi kèm.', 'glass-water',
 $$Bình nước 19–20 lít có hai kiểu chính: bình úp (lắp ngược lên cây nước nóng lạnh) và bình vòi (đặt đứng, có vòi rót ở thân bình).
## Bình úp
Phù hợp khi bạn đã có cây nước nóng lạnh. Nước được lấy qua cây nên dùng được cả nước nóng và lạnh. Khi thay bình cần nhấc và lật bình, hơi nặng với người lớn tuổi.
## Bình vòi
Không cần cây nước, đặt lên kệ là dùng được ngay. Hợp với phòng họp, quầy lễ tân, gia đình ít người hoặc nơi không có ổ điện gần.
## Gợi ý nhanh
Văn phòng đông người, cần nước nóng pha trà, cà phê: chọn bình úp. Nhà ở, cửa hàng nhỏ, cần gọn và dễ thay: chọn bình vòi.$$,
 TRUE, DATE '2026-10-28'),
('NEWS', 'bao-quan-binh-19l', 'Bảo quản bình nước 19L sau khi mở nắp đúng cách',
 'Vài thói quen nhỏ giúp nước luôn ngon và bình dùng được lâu hơn.', 'thermometer-sun',
 $$Nước đóng bình an toàn khi còn niêm phong. Sau khi mở nắp, cách bảo quản quyết định chất lượng nước tới giọt cuối cùng.
## Tránh nắng và nguồn nhiệt
Đặt bình nơi thoáng mát, không để gần cửa sổ có nắng chiếu trực tiếp hay cạnh bếp. Nhiệt độ cao làm nước nhanh có mùi nhựa.
## Dùng hết trong vài ngày
Nên dùng hết bình đã mở trong khoảng 7–10 ngày. Nếu nhà ít người, cân nhắc đặt bình nhỏ hơn hoặc nước thùng chai.
## Vệ sinh cây nước định kỳ
Mỗi lần thay bình, lau sạch miệng bình và khay hứng nước. Cây nước nên được vệ sinh bên trong khoảng 1–2 tháng một lần.$$,
 TRUE, DATE '2026-10-21'),
('NEWS', 'coc-vo-binh-la-gi', 'Cọc vỏ bình là gì và khi nào được hoàn lại?',
 'Lần đầu đặt bình 19L bạn sẽ gặp khoản cọc vỏ. Đây là cách nó hoạt động.', 'recycle',
 $$Vỏ bình 19–20 lít được dùng lại nhiều lần. Khi bạn chưa có vỏ để đổi, cửa hàng thu một khoản cọc cho mỗi vỏ giao kèm.
## Đổi vỏ ở những lần sau
Từ lần đặt thứ hai, nhân viên giao bình mới và thu lại vỏ cũ trong cùng một lần giao. Bạn chỉ trả tiền nước, không cọc thêm.
## Hoàn cọc
Khi không dùng nữa, bạn trả lại vỏ còn nguyên vẹn và nhận lại tiền cọc. Vỏ bị nứt, vỡ hoặc mất có thể không được hoàn đủ.
Mức cọc cụ thể do cửa hàng thông báo khi xác nhận đơn.$$,
 TRUE, DATE '2026-10-14'),
('NEWS', 'nuoc-tinh-khiet-va-nuoc-khoang', 'Nước tinh khiết và nước khoáng khác nhau thế nào?',
 'Cùng là nước uống đóng chai nhưng nguồn và thành phần không giống nhau.', 'droplets',
 $$## Nước tinh khiết
Được lọc qua nhiều bước (thường có thẩm thấu ngược) để loại gần hết tạp chất và khoáng chất. Vị nhạt, trung tính, hợp pha trà, cà phê, sữa cho trẻ.
## Nước khoáng
Lấy từ nguồn khoáng tự nhiên, giữ lại các khoáng chất như canxi, magie, bicarbonat. Vị đậm hơn, có loại có gas.
## Nên chọn loại nào?
Uống hằng ngày cho cả nhà: nước tinh khiết bình lớn là tiết kiệm. Muốn bổ sung khoáng hoặc thích vị đậm: chọn nước khoáng chai nhỏ để dùng xen kẽ.$$,
 TRUE, DATE '2026-10-07'),
('NEWS', 'dat-nuoc-dinh-ky', 'Mẹo đặt nước đúng lúc để không bao giờ hết giữa chừng',
 'Ước lượng lượng nước dùng mỗi tuần và đặt trước một ngày.', 'calendar-clock',
 $$Một người lớn uống khoảng 1,5–2 lít mỗi ngày. Gia đình 4 người thường dùng hết một bình 19L trong 3–4 ngày.
## Đặt khi còn khoảng 1/4 bình
Đừng đợi cạn hẳn. Khi bình còn khoảng một phần tư, đặt đơn mới để cửa hàng kịp sắp xếp chuyến giao.
## Đặt nhiều bình một lần
Văn phòng hoặc cửa hàng nên giữ sẵn 1–2 bình dự phòng. Đặt nhiều bình một lần cũng giúp giảm số lần giao.$$,
 TRUE, DATE '2026-09-30'),
('POLICY', 'giao-hang', 'Chính sách giao hàng', 'Khu vực giao, thời gian và phí giao hàng.', 'truck',
 $$## Khu vực và thời gian
Cửa hàng giao trong các khu vực đã đăng ký phục vụ. Đơn được xếp vào chuyến giao theo tuyến; nhân viên gọi xác nhận giờ giao trước khi đi.
## Phí giao
Phí giao tùy khu vực và số lượng, được báo khi cửa hàng xác nhận đơn. Đơn nhiều bình, thùng có thể được miễn phí giao.
## Khi không giao được
Nếu không liên lạc được hoặc không có người nhận, nhân viên mang hàng về cửa hàng và liên hệ để hẹn giao lại. Hàng mang về được kiểm tra trước khi giao lần sau.$$,
 TRUE, NULL),
('POLICY', 'coc-tra-vo', 'Cọc và trả vỏ bình', 'Cách tính cọc vỏ bình 19–20 lít và hoàn cọc.', 'recycle',
 $$Khách chưa có vỏ để đổi được thu cọc cho mỗi vỏ giao kèm. Mức cọc do cửa hàng thông báo khi xác nhận đơn.
## Đổi vỏ
Những lần đặt sau, nhân viên giao bình mới và thu vỏ cũ trong cùng một lần giao; không thu thêm cọc.
## Hoàn cọc
Trả lại vỏ còn nguyên vẹn để nhận lại tiền cọc. Vỏ nứt, vỡ hoặc mất có thể không được hoàn đủ.$$,
 TRUE, NULL),
('POLICY', 'doi-tra', 'Chính sách đổi trả', 'Những trường hợp được đổi hàng hoặc hoàn tiền.', 'rotate-ccw',
 $$## Kiểm tra khi nhận
Vui lòng kiểm tra niêm phong, hạn dùng và số lượng ngay khi nhận hàng.
## Được đổi ngay
Hàng mất niêm phong, rò rỉ, quá hạn dùng hoặc giao sai sản phẩm được đổi miễn phí trong lần giao hoặc liên hệ cửa hàng sớm nhất.
## Hoàn tiền
Khi không thể đổi, cửa hàng hoàn tiền cho phần hàng lỗi bằng tiền mặt hoặc chuyển khoản.$$,
 TRUE, NULL),
('POLICY', 'thanh-toan', 'Hình thức thanh toán', 'Thanh toán khi nhận hàng bằng tiền mặt hoặc chuyển khoản.', 'wallet',
 $$Bạn thanh toán khi nhận hàng, không cần trả trước khi đặt online.
## Tiền mặt
Trả trực tiếp cho nhân viên giao hàng.
## Chuyển khoản
Chuyển khoản theo thông tin nhân viên cung cấp; ghi mã đơn trong nội dung để cửa hàng đối soát nhanh.$$,
 TRUE, NULL);
