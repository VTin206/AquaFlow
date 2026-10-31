import {
  Boxes,
  Building2,
  FileBarChart,
  History,
  LayoutDashboard,
  type LucideIcon,
  Package,
  ShoppingBag,
  Smartphone,
  Truck,
  Users,
} from 'lucide-react'

export type NavItem = { path: string; label: string; icon: LucideIcon }

export const navGroups: { label: string; items: NavItem[] }[] = [
  { label: 'Không gian làm việc', items: [{ path: '/', label: 'Tổng quan', icon: LayoutDashboard }] },
  {
    label: 'Vận hành',
    items: [
      { path: '/orders', label: 'Đơn hàng', icon: ShoppingBag },
      { path: '/inventory', label: 'Kho hàng', icon: Boxes },
      { path: '/delivery', label: 'Giao hàng', icon: Truck },
      { path: '/driver', label: 'Màn hình tài xế', icon: Smartphone },
    ],
  },
  {
    label: 'Quản lý',
    items: [
      { path: '/products', label: 'Sản phẩm', icon: Package },
      { path: '/suppliers', label: 'Nhà cung cấp', icon: Building2 },
      { path: '/customers', label: 'Khách hàng', icon: Users },
      { path: '/reports', label: 'Báo cáo', icon: FileBarChart },
      { path: '/activity', label: 'Nhật ký', icon: History },
    ],
  },
]
