import { Boxes, FileBarChart, LayoutDashboard, type LucideIcon, Package, ShoppingBag, Truck, Users } from 'lucide-react'

export type NavItem = { path: string; label: string; icon: LucideIcon }

export const navGroups: { label: string; items: NavItem[] }[] = [
  { label: 'Tổng quan', items: [{ path: '/', label: 'Tổng quan', icon: LayoutDashboard }] },
  {
    label: 'Vận hành',
    items: [
      { path: '/orders', label: 'Đơn hàng', icon: ShoppingBag },
      { path: '/inventory', label: 'Kho hàng', icon: Boxes },
      { path: '/products', label: 'Sản phẩm', icon: Package },
      { path: '/delivery', label: 'Giao hàng', icon: Truck },
    ],
  },
  { label: 'Đối tác', items: [{ path: '/customers', label: 'Khách hàng', icon: Users }] },
  { label: 'Phân tích', items: [{ path: '/reports', label: 'Báo cáo', icon: FileBarChart }] },
]
