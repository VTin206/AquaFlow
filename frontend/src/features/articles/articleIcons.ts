import { createElement } from 'react'
import type { LucideIcon, LucideProps } from 'lucide-react'
import {
  CalendarClock,
  Droplets,
  Gift,
  GlassWater,
  Megaphone,
  Newspaper,
  Recycle,
  RotateCcw,
  ShieldCheck,
  ThermometerSun,
  Truck,
  Wallet,
} from 'lucide-react'

/** Icon chọn được cho bài viết. Khớp `ShopArticleService.ICONS` ở BE: thêm icon thì thêm ở cả hai phía. */
export const articleIcons: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'newspaper', label: 'Tin tức', icon: Newspaper },
  { key: 'megaphone', label: 'Thông báo', icon: Megaphone },
  { key: 'gift', label: 'Khuyến mãi', icon: Gift },
  { key: 'glass-water', label: 'Ly nước', icon: GlassWater },
  { key: 'droplets', label: 'Giọt nước', icon: Droplets },
  { key: 'thermometer-sun', label: 'Bảo quản', icon: ThermometerSun },
  { key: 'recycle', label: 'Vỏ bình', icon: Recycle },
  { key: 'calendar-clock', label: 'Lịch đặt', icon: CalendarClock },
  { key: 'truck', label: 'Giao hàng', icon: Truck },
  { key: 'rotate-ccw', label: 'Đổi trả', icon: RotateCcw },
  { key: 'wallet', label: 'Thanh toán', icon: Wallet },
  { key: 'shield-check', label: 'Cam kết', icon: ShieldCheck },
]

const byKey = new Map(articleIcons.map((item) => [item.key, item.icon]))

/** Icon của bài theo khóa lưu ở BE. Khóa lạ (BE mới thêm icon mà FE chưa có) thì dùng icon tin tức thay vì vỡ trang. */
export function ArticleIcon({ name, ...props }: LucideProps & { name: string }) {
  return createElement(byKey.get(name) ?? Newspaper, props)
}
