import type { LucideIcon } from 'lucide-react'
import { CalendarClock, Droplets, GlassWater, Recycle, RotateCcw, ThermometerSun, Truck, Wallet } from 'lucide-react'

/**
 * Bài viết trên trang khách. BE chưa có API tin tức nên nội dung viết sẵn ở FE;
 * khi có API thì thay mảng này bằng truy vấn, giữ nguyên kiểu `ShopArticle`.
 */
export type ShopArticle = {
  slug: string
  title: string
  summary: string
  /** "yyyy-mm-dd"; trang chính sách không ghi ngày. */
  publishedOn?: string
  icon: LucideIcon
  /** Mỗi phần tử là một đoạn; đoạn bắt đầu bằng "## " là tiêu đề nhỏ. */
  body: string[]
}

export const shopArticles: ShopArticle[] = [
  {
    slug: 'binh-up-hay-binh-voi',
    title: 'Bình úp hay bình vòi: chọn loại nào cho gia đình và văn phòng?',
    summary: 'Hai kiểu bình 19–20 lít phổ biến nhất, khác nhau ở cách dùng và thiết bị đi kèm.',
    publishedOn: '2026-10-28',
    icon: GlassWater,
    body: [
      'Bình nước 19–20 lít có hai kiểu chính: bình úp (lắp ngược lên cây nước nóng lạnh) và bình vòi (đặt đứng, có vòi rót ở thân bình).',
      '## Bình úp',
      'Phù hợp khi bạn đã có cây nước nóng lạnh. Nước được lấy qua cây nên dùng được cả nước nóng và lạnh. Khi thay bình cần nhấc và lật bình, hơi nặng với người lớn tuổi.',
      '## Bình vòi',
      'Không cần cây nước, đặt lên kệ là dùng được ngay. Hợp với phòng họp, quầy lễ tân, gia đình ít người hoặc nơi không có ổ điện gần.',
      '## Gợi ý nhanh',
      'Văn phòng đông người, cần nước nóng pha trà, cà phê: chọn bình úp. Nhà ở, cửa hàng nhỏ, cần gọn và dễ thay: chọn bình vòi.',
    ],
  },
  {
    slug: 'bao-quan-binh-19l',
    title: 'Bảo quản bình nước 19L sau khi mở nắp đúng cách',
    summary: 'Vài thói quen nhỏ giúp nước luôn ngon và bình dùng được lâu hơn.',
    publishedOn: '2026-10-21',
    icon: ThermometerSun,
    body: [
      'Nước đóng bình an toàn khi còn niêm phong. Sau khi mở nắp, cách bảo quản quyết định chất lượng nước tới giọt cuối cùng.',
      '## Tránh nắng và nguồn nhiệt',
      'Đặt bình nơi thoáng mát, không để gần cửa sổ có nắng chiếu trực tiếp hay cạnh bếp. Nhiệt độ cao làm nước nhanh có mùi nhựa.',
      '## Dùng hết trong vài ngày',
      'Nên dùng hết bình đã mở trong khoảng 7–10 ngày. Nếu nhà ít người, cân nhắc đặt bình nhỏ hơn hoặc nước thùng chai.',
      '## Vệ sinh cây nước định kỳ',
      'Mỗi lần thay bình, lau sạch miệng bình và khay hứng nước. Cây nước nên được vệ sinh bên trong khoảng 1–2 tháng một lần.',
    ],
  },
  {
    slug: 'coc-vo-binh-la-gi',
    title: 'Cọc vỏ bình là gì và khi nào được hoàn lại?',
    summary: 'Lần đầu đặt bình 19L bạn sẽ gặp khoản cọc vỏ. Đây là cách nó hoạt động.',
    publishedOn: '2026-10-14',
    icon: Recycle,
    body: [
      'Vỏ bình 19–20 lít được dùng lại nhiều lần. Khi bạn chưa có vỏ để đổi, cửa hàng thu một khoản cọc cho mỗi vỏ giao kèm.',
      '## Đổi vỏ ở những lần sau',
      'Từ lần đặt thứ hai, nhân viên giao bình mới và thu lại vỏ cũ trong cùng một lần giao. Bạn chỉ trả tiền nước, không cọc thêm.',
      '## Hoàn cọc',
      'Khi không dùng nữa, bạn trả lại vỏ còn nguyên vẹn và nhận lại tiền cọc. Vỏ bị nứt, vỡ hoặc mất có thể không được hoàn đủ.',
      'Mức cọc cụ thể do cửa hàng thông báo khi xác nhận đơn.',
    ],
  },
  {
    slug: 'nuoc-tinh-khiet-va-nuoc-khoang',
    title: 'Nước tinh khiết và nước khoáng khác nhau thế nào?',
    summary: 'Cùng là nước uống đóng chai nhưng nguồn và thành phần không giống nhau.',
    publishedOn: '2026-10-07',
    icon: Droplets,
    body: [
      '## Nước tinh khiết',
      'Được lọc qua nhiều bước (thường có thẩm thấu ngược) để loại gần hết tạp chất và khoáng chất. Vị nhạt, trung tính, hợp pha trà, cà phê, sữa cho trẻ.',
      '## Nước khoáng',
      'Lấy từ nguồn khoáng tự nhiên, giữ lại các khoáng chất như canxi, magie, bicarbonat. Vị đậm hơn, có loại có gas.',
      '## Nên chọn loại nào?',
      'Uống hằng ngày cho cả nhà: nước tinh khiết bình lớn là tiết kiệm. Muốn bổ sung khoáng hoặc thích vị đậm: chọn nước khoáng chai nhỏ để dùng xen kẽ.',
    ],
  },
  {
    slug: 'dat-nuoc-dinh-ky',
    title: 'Mẹo đặt nước đúng lúc để không bao giờ hết giữa chừng',
    summary: 'Ước lượng lượng nước dùng mỗi tuần và đặt trước một ngày.',
    publishedOn: '2026-09-30',
    icon: CalendarClock,
    body: [
      'Một người lớn uống khoảng 1,5–2 lít mỗi ngày. Gia đình 4 người thường dùng hết một bình 19L trong 3–4 ngày.',
      '## Đặt khi còn khoảng 1/4 bình',
      'Đừng đợi cạn hẳn. Khi bình còn khoảng một phần tư, đặt đơn mới để cửa hàng kịp sắp xếp chuyến giao.',
      '## Đặt nhiều bình một lần',
      'Văn phòng hoặc cửa hàng nên giữ sẵn 1–2 bình dự phòng. Đặt nhiều bình một lần cũng giúp giảm số lần giao.',
    ],
  },
]

/** Trang chính sách ở chân trang khách; viết chung chung vì mức phí, cọc cụ thể do cửa hàng báo khi xác nhận đơn. */
export const shopPolicies: ShopArticle[] = [
  {
    slug: 'giao-hang',
    title: 'Chính sách giao hàng',
    summary: 'Khu vực giao, thời gian và phí giao hàng.',
    icon: Truck,
    body: [
      '## Khu vực và thời gian',
      'Cửa hàng giao trong các khu vực đã đăng ký phục vụ. Đơn được xếp vào chuyến giao theo tuyến; nhân viên gọi xác nhận giờ giao trước khi đi.',
      '## Phí giao',
      'Phí giao tùy khu vực và số lượng, được báo khi cửa hàng xác nhận đơn. Đơn nhiều bình, thùng có thể được miễn phí giao.',
      '## Khi không giao được',
      'Nếu không liên lạc được hoặc không có người nhận, nhân viên mang hàng về cửa hàng và liên hệ để hẹn giao lại. Hàng mang về được kiểm tra trước khi giao lần sau.',
    ],
  },
  {
    slug: 'coc-tra-vo',
    title: 'Cọc và trả vỏ bình',
    summary: 'Cách tính cọc vỏ bình 19–20 lít và hoàn cọc.',
    icon: Recycle,
    body: [
      'Khách chưa có vỏ để đổi được thu cọc cho mỗi vỏ giao kèm. Mức cọc do cửa hàng thông báo khi xác nhận đơn.',
      '## Đổi vỏ',
      'Những lần đặt sau, nhân viên giao bình mới và thu vỏ cũ trong cùng một lần giao; không thu thêm cọc.',
      '## Hoàn cọc',
      'Trả lại vỏ còn nguyên vẹn để nhận lại tiền cọc. Vỏ nứt, vỡ hoặc mất có thể không được hoàn đủ.',
    ],
  },
  {
    slug: 'doi-tra',
    title: 'Chính sách đổi trả',
    summary: 'Những trường hợp được đổi hàng hoặc hoàn tiền.',
    icon: RotateCcw,
    body: [
      '## Kiểm tra khi nhận',
      'Vui lòng kiểm tra niêm phong, hạn dùng và số lượng ngay khi nhận hàng.',
      '## Được đổi ngay',
      'Hàng mất niêm phong, rò rỉ, quá hạn dùng hoặc giao sai sản phẩm được đổi miễn phí trong lần giao hoặc liên hệ cửa hàng sớm nhất.',
      '## Hoàn tiền',
      'Khi không thể đổi, cửa hàng hoàn tiền cho phần hàng lỗi bằng tiền mặt hoặc chuyển khoản.',
    ],
  },
  {
    slug: 'thanh-toan',
    title: 'Hình thức thanh toán',
    summary: 'Thanh toán khi nhận hàng bằng tiền mặt hoặc chuyển khoản.',
    icon: Wallet,
    body: [
      'Bạn thanh toán khi nhận hàng, không cần trả trước khi đặt online.',
      '## Tiền mặt',
      'Trả trực tiếp cho nhân viên giao hàng.',
      '## Chuyển khoản',
      'Chuyển khoản theo thông tin nhân viên cung cấp; ghi mã đơn trong nội dung để cửa hàng đối soát nhanh.',
    ],
  },
]

export const findPolicy = (slug: string) => shopPolicies.find((policy) => policy.slug === slug)

export const articleDate = (isoDate: string) => new Date(`${isoDate}T00:00:00`).toLocaleDateString('vi-VN')

export const findArticle = (slug: string) => shopArticles.find((article) => article.slug === slug)
