import { useEffect, useState } from 'react'
import { App, Avatar, Button, Dropdown, Tooltip, type MenuProps } from 'antd'
import { Bell, Check, ChevronDown, Clock3, LogOut, Menu as MenuIcon, ShoppingCart, Waves } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { roleNames, type RoleCode } from '../features/auth/permissions'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../features/auth/useAuth'
import { devAccounts, type DevAccount } from '../features/auth/devAccounts'
import { setDemoRole, useStaff } from '../features/auth/useStaff'
import { useFeature } from '../shared/features'
import { NotificationPopover } from './NotificationPopover'

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
})
const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

function TopbarClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <time className="af-topbar-clock" dateTime={now.toISOString()} title="Giờ Việt Nam (UTC+7)">
      <Clock3 size={16} aria-hidden />
      {dateFormatter.format(now)} · {timeFormatter.format(now)}
    </time>
  )
}

/** Thanh ứng dụng và các thao tác nhanh. */
export function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const { logout, login, enterDemo } = useAuth()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const staff = useStaff()
  const navigate = useNavigate()
  // Dev: đổi tài khoản không cần qua trang đăng nhập; xóa cache để không lẫn dữ liệu của tài khoản trước.
  const switchTo = async (account: DevAccount) => {
    try {
      await login(account)
      queryClient.clear()
      message.success(`Đã chuyển sang ${account.label}.`)
      navigate('/', { replace: true })
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Đăng nhập thất bại.')
    }
  }
  const switchTargets: NonNullable<MenuProps['items']> = [
    ...(staff && !staff.isDemo
      ? [{ key: 'switch:demo', label: 'Bản dùng thử', onClick: () => { enterDemo(); queryClient.clear(); navigate('/', { replace: true }) } }]
      : []),
    ...devAccounts.map((account) => ({
      key: `switch:${account.email}`,
      label: account.label,
      title: account.email,
      onClick: () => void switchTo(account),
    })),
  ]
  const switchItems: MenuProps['items'] = import.meta.env.DEV && switchTargets.length
    ? [
        { type: 'group', key: 'switch', label: 'Đổi tài khoản (dev)', children: switchTargets },
        { type: 'divider' },
      ]
    : []
  const showNotifications = useFeature('notifications')
  const logoutItem = { key: 'logout', danger: true, icon: <LogOut size={16} />, label: 'Đăng xuất', onClick: () => { logout(); navigate('/login', { replace: true }) } }
  // Bản dùng thử: đổi vai trò để xem menu và quyền của từng nhân viên.
  const menuItems: MenuProps['items'] = staff?.isDemo
    ? [
        {
          type: 'group',
          key: 'role',
          label: 'Xem với vai trò',
          children: (Object.keys(roleNames) as RoleCode[]).map((role) => ({
            key: role,
            label: roleNames[role],
            icon: <Check size={16} style={{ visibility: staff.role === role ? 'visible' : 'hidden' }} />,
            onClick: () => setDemoRole(role),
          })),
        },
        { type: 'divider' },
        ...switchItems,
        logoutItem,
      ]
    : [...switchItems, logoutItem]

  return (
    <header className="af-topbar">
      <div className="af-topbar-left">
        <Button type="text" className="af-topbar-icon af-nav-toggle" aria-label="Mở menu" icon={<MenuIcon size={20} />} onClick={onOpenNav} />
        <Link to="/" className="af-topbar-brand">
          <span className="af-brand-mark">
            <Waves size={22} strokeWidth={2.2} />
          </span>
          <strong>AquaFlow</strong>
        </Link>
        <span className="af-topbar-divider" aria-hidden />
        <TopbarClock />
      </div>
      <div className="af-topbar-right">
        {staff?.isDemo && <span className="af-demo-label">Dữ liệu mẫu</span>}
        <Tooltip title={staff?.isDemo ? 'Trang khách đặt hàng (dùng chung dữ liệu mẫu trong tab này)' : 'Trang khách đặt hàng'}>
          <Link to="/shop" className="af-notification-link" aria-label="Mở trang khách đặt hàng">
            <ShoppingCart size={19} aria-hidden />
          </Link>
        </Tooltip>
        {showNotifications ? <NotificationPopover /> : (
          <Tooltip title="Thông báo: backend chưa hỗ trợ">
            <Button type="text" className="af-topbar-icon" aria-label="Thông báo (chưa hỗ trợ)" icon={<Bell size={19} />} disabled />
          </Tooltip>
        )}
        <Dropdown
          trigger={['click']}
          menu={{ items: menuItems }}
        >
          <button type="button" className="af-topbar-user af-account-menu" aria-label="Menu tài khoản">
            <Avatar className="af-avatar">{(staff?.name ?? 'A').split(/\s+/).map((part) => part[0]).slice(-2).join('').toUpperCase()}</Avatar>
            <div className="af-topbar-user-text">
              <strong>{staff?.name ?? 'Quản trị viên'}</strong>
              <small>{staff ? `${staff.roleName}${staff.isDemo ? ' · dùng thử' : ''}` : 'Quản trị viên'}</small>
            </div>
            <ChevronDown size={14} aria-hidden />
          </button>
        </Dropdown>
      </div>
    </header>
  )
}
