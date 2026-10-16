import { Boxes, FileBarChart, LayoutDashboard, type LucideIcon, Package, ShoppingBag, Truck, Users } from 'lucide-react'

export type NavItem = { path: string; label: string; icon: LucideIcon }

export const navGroups: { label: string; items: NavItem[] }[] = [
  { label: 'Không gian làm việc', items: [{ path: '/', label: 'Tổng quan', icon: LayoutDashboard }] },
  {
    label: 'Vận hành',
    items: [
      { path: '/orders', label: 'Đơn hàng', icon: ShoppingBag },
      { path: '/inventory', label: 'Kho hàng', icon: Boxes },
      { path: '/delivery', label: 'Giao hàng', icon: Truck },
    ],
  },
  {
    label: 'Quản lý',
    items: [
      { path: '/products', label: 'Sản phẩm', icon: Package },
      { path: '/customers', label: 'Khách hàng', icon: Users },
      { path: '/reports', label: 'Báo cáo', icon: FileBarChart },
    ],
  },
]
