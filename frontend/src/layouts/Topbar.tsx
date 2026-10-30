import { useEffect, useState } from 'react'
import { Avatar, Button, Dropdown, Tooltip } from 'antd'
import { Bell, ChevronDown, Clock3, Menu as MenuIcon, ShoppingCart, Waves } from 'lucide-react'
import { Link } from 'react-router'
import { useStaff } from '../features/auth/useStaff'
import { useFeature } from '../shared/features'
import { NotificationPopover } from './NotificationPopover'
import { initialsOf, useAccountMenuItems } from './useAccountMenu'

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
  const staff = useStaff()
  const menuItems = useAccountMenuItems()
  const showNotifications = useFeature('notifications')

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
            <Avatar className="af-avatar">{initialsOf(staff?.name ?? 'A')}</Avatar>
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
