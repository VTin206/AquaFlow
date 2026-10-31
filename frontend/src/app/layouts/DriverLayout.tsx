import { Suspense } from 'react'
import { Avatar, Button, Dropdown, Spin } from 'antd'
import { ArrowLeft, ChevronDown, Waves } from 'lucide-react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { canOpen, homeOf } from '@/features/auth/permissions'
import { useStaff } from '@/features/auth/useStaff'
import { ThemeToggle } from './ThemeToggle'
import { initialsOf, useAccountMenuItems, useMockSession } from './useAccountMenu'
import '@/features/delivery/driver.css'

/**
 * Khung riêng cho nhân viên giao hàng: chỉ có màn hình chuyến, không sidebar, vừa màn hình điện thoại.
 * Chủ cửa hàng cũng mở được để xem thay tài xế và quay về trang quản lý.
 */
export function DriverLayout() {
  const staff = useStaff()
  const { pathname } = useLocation()
  const menuItems = useAccountMenuItems()
  useMockSession(staff)

  if (staff && !canOpen(staff.role, pathname)) return <Navigate to={homeOf(staff.role)} replace />

  return (
    <div className="af-driver-shell">
      <header className="af-driver-bar">
        {staff?.role === 'DELIVERY_STAFF' ? (
          <span className="af-topbar-brand">
            <span className="af-brand-mark">
              <Waves size={20} strokeWidth={2.2} />
            </span>
            <strong>AquaFlow</strong>
            <small>Giao hàng</small>
          </span>
        ) : (
          <Link to="/delivery">
            <Button type="text" icon={<ArrowLeft size={17} />}>
              Trang quản lý
            </Button>
          </Link>
        )}
        <div className="af-driver-bar-right">
          {staff?.isDemo && <span className="af-demo-label">Dữ liệu mẫu</span>}
          <ThemeToggle />
          <Dropdown trigger={['click']} menu={{ items: menuItems }}>
            <button type="button" className="af-account-menu af-driver-account" aria-label="Menu tài khoản">
              <Avatar size={32} className="af-avatar">
                {initialsOf(staff?.name ?? 'A')}
              </Avatar>
              <ChevronDown size={14} aria-hidden />
            </button>
          </Dropdown>
        </div>
      </header>
      <main className="af-driver-main">
        <Suspense
          fallback={
            <div className="af-page-loading">
              <Spin size="large" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
