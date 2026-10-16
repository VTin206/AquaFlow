import { Boxes, FileBarChart, LayoutDashboard, type LucideIcon, Package, ShoppingBag, Truck, Users } from 'lucide-react'
import type { Section } from '../types'

export const navGroups: { label: string; items: { id: Section; label: string; icon: LucideIcon }[] }[] = [
  { label: 'TỔNG QUAN', items: [{ id: 'overview', label: 'Tổng quan', icon: LayoutDashboard }] },
  {
    label: 'VẬN HÀNH',
    items: [
      { id: 'orders', label: 'Đơn hàng', icon: ShoppingBag },
      { id: 'inventory', label: 'Kho hàng', icon: Boxes },
      { id: 'products', label: 'Sản phẩm', icon: Package },
      { id: 'delivery', label: 'Giao hàng', icon: Truck },
    ],
  },
  { label: 'ĐỐI TÁC', items: [{ id: 'customers', label: 'Khách hàng', icon: Users }] },
  { label: 'PHÂN TÍCH', items: [{ id: 'reports', label: 'Báo cáo', icon: FileBarChart }] },
]

export const sectionCopy: Record<Section, { title: string; description: string }> = {
  overview: { title: 'Tổng quan', description: 'Theo dõi nhanh tình hình hoạt động của cửa hàng.' },
  orders: { title: 'Đơn hàng', description: 'Tiếp nhận, chuẩn bị và theo dõi đơn hàng.' },
  inventory: { title: 'Kho hàng', description: 'Theo dõi số lượng tồn, lô hàng và hạn sử dụng.' },
  products: { title: 'Sản phẩm', description: 'Quản lý danh mục và giá bán hiện tại.' },
  customers: { title: 'Khách hàng', description: 'Thông tin liên hệ, lịch sử mua và số vỏ đang giữ.' },
  delivery: { title: 'Giao hàng', description: 'Theo dõi chuyến giao và kết quả giao nhận.' },
  reports: { title: 'Báo cáo', description: 'Tổng hợp bán hàng, doanh thu và tình hình kho.' },
}
