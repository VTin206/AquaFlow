import { Suspense } from 'react'
import { Avatar, Dropdown, Skeleton } from 'antd'
import { ChevronDown, Waves } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { canOpen, homeOf } from '@/features/auth/permissions'
import { useStaff } from '@/features/auth/useStaff'
import { ThemeToggle } from './ThemeToggle'
import { initialsOf, useAccountMenuItems, useMockSession } from './useAccountMenu'
import '@/features/delivery/driver.css'
import { ErrorBoundary } from '../ErrorBoundary'

/**
 * Khung riêng cho nhân viên giao hàng: chỉ có màn hình chuyến, không sidebar, vừa màn hình điện thoại.
 * Chỉ tài khoản giao hàng vào được; vai trò khác bị đưa về trang chủ của mình.
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
        <span className="af-topbar-brand">
          <span className="af-brand-mark">
            <Waves size={20} strokeWidth={2.2} />
          </span>
          <strong>AquaFlow</strong>
          <small>Giao hàng</small>
        </span>
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
        <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
          <ErrorBoundary key={pathname} homeHref="/driver"><Outlet /></ErrorBoundary>
        </Suspense>
      </main>
    </div>
  )
}
