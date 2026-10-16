import type { Customer } from '../features/customers/types'
import type { Order } from '../features/orders/types'
import type { Product } from '../features/inventory/types'

export const initialOrders: Order[] = [
  { id: 'AF-1048', customer: 'Nguyễn Văn An', phone: '0903 456 128', address: 'Phường Thảo Điền, TP. Thủ Đức', items: '2 bình 20L, 1 thùng 500ml', total: 185000, time: '09:42', status: 'Đang giao', method: 'Giao tận nơi' },
  { id: 'AF-1047', customer: 'Cửa hàng Minh Tâm', phone: '0918 220 467', address: 'Đường Nguyễn Văn Linh, Quận 7', items: '10 bình 20L', total: 1200000, time: '09:28', status: 'Đã hoàn tất', method: 'Giao tận nơi' },
  { id: 'AF-1046', customer: 'Trần Thị Hương', phone: '0938 113 602', address: 'Phường 6, Quận 3', items: '1 bình 20L + vỏ bình', total: 95000, time: '09:16', status: 'Chờ xác nhận', method: 'Giao tận nơi' },
  { id: 'AF-1045', customer: 'Văn phòng Green Hub', phone: '028 3822 8855', address: 'Đường Điện Biên Phủ, Bình Thạnh', items: '5 thùng chai 500ml', total: 450000, time: '08:54', status: 'Đang chuẩn bị', method: 'Giao tận nơi' },
  { id: 'AF-1044', customer: 'Lê Hoàng Phúc', phone: '0908 772 351', address: 'Khách nhận tại cửa hàng', items: '3 bình 20L', total: 210000, time: '08:31', status: 'Đã hoàn tất', method: 'Tại quầy' },
]

export const initialProducts: Product[] = [
  { id: 'P-001', name: 'Nước tinh khiết bình 20L', brand: 'AquaFlow', unit: 'Bình', stock: 12, threshold: 20, price: 70000, expiry: '12/08/2027', sku: 'AQUA-20L' },
  { id: 'P-002', name: 'Vỏ bình 20L', brand: 'Dùng luân chuyển', unit: 'Vỏ', stock: 28, threshold: 35, price: 50000, expiry: '—', sku: 'VO-20L' },
  { id: 'P-003', name: 'Nước chai 500ml (24 chai)', brand: 'AquaFlow', unit: 'Thùng', stock: 64, threshold: 24, price: 90000, expiry: '02/03/2027', sku: 'AQUA-500' },
  { id: 'P-004', name: 'Nước tinh khiết bình 19L', brand: 'Lavie', unit: 'Bình', stock: 36, threshold: 18, price: 65000, expiry: '18/05/2027', sku: 'LAVIE-19L' },
  { id: 'P-005', name: 'Nước chai 1.5L (12 chai)', brand: 'AquaFlow', unit: 'Thùng', stock: 18, threshold: 20, price: 108000, expiry: '21/01/2027', sku: 'AQUA-15L' },
]

export const customers: Customer[] = [
  { name: 'Nguyễn Văn An', phone: '0903 456 128', area: 'Thảo Điền, TP. Thủ Đức', orders: 28, bottlesHeld: 2, initials: 'NA' },
  { name: 'Cửa hàng Minh Tâm', phone: '0918 220 467', area: 'Quận 7', orders: 64, bottlesHeld: 0, initials: 'MT' },
  { name: 'Trần Thị Hương', phone: '0938 113 602', area: 'Quận 3', orders: 12, bottlesHeld: 1, initials: 'TH' },
  { name: 'Văn phòng Green Hub', phone: '028 3822 8855', area: 'Bình Thạnh', orders: 19, bottlesHeld: 5, initials: 'GH' },
  { name: 'Lê Hoàng Phúc', phone: '0908 772 351', area: 'Phú Nhuận', orders: 8, bottlesHeld: 0, initials: 'LP' },
]

/** Doanh thu mẫu theo ngày (đồng), dùng cho biểu đồ khi chưa có API báo cáo. */
export const dailyRevenue: { date: string; revenue: number }[] = [
  { date: '2026-10-05', revenue: 2_140_000 },
  { date: '2026-10-06', revenue: 2_860_000 },
  { date: '2026-10-07', revenue: 2_420_000 },
  { date: '2026-10-08', revenue: 3_310_000 },
  { date: '2026-10-09', revenue: 2_750_000 },
  { date: '2026-10-10', revenue: 3_920_000 },
  { date: '2026-10-11', revenue: 3_180_000 },
  { date: '2026-10-12', revenue: 2_560_000 },
  { date: '2026-10-13', revenue: 2_980_000 },
  { date: '2026-10-14', revenue: 3_440_000 },
  { date: '2026-10-15', revenue: 2_610_000 },
  { date: '2026-10-16', revenue: 1_395_000 },
]
