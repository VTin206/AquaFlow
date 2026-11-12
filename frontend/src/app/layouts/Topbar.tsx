import { useEffect, useState } from 'react'
import { Avatar, Button, Dropdown } from 'antd'
import { ChevronDown, Clock3, Menu as MenuIcon } from 'lucide-react'
import { Link } from 'react-router'
import { useHomeLink } from '@/app/useHomeLink'
import { useStaff } from '@/features/auth/useStaff'
import { GlobalSearch } from './GlobalSearch'
import { NotificationPopover } from './NotificationPopover'
import { ThemeToggle } from './ThemeToggle'
import { initialsOf, useAccountMenuItems } from './useAccountMenu'

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
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
  const goHome = useHomeLink('/')

  return (
    <header className="af-topbar">
      <div className="af-topbar-left">
        <Button
          type="text"
          className="af-topbar-icon af-nav-toggle"
          aria-label="Mở menu"
          icon={<MenuIcon size={20} />}
          onClick={onOpenNav}
        />
        <Link to="/" className="af-topbar-brand" onClick={goHome} aria-label="AquaFlow - Trang chủ quản trị">
          <img className="af-brand-logo" src="/images/aquaflow-logo.png" alt="AquaFlow" />
        </Link>
        <span className="af-topbar-divider" aria-hidden />
        <TopbarClock />
      </div>
      <div className="af-topbar-right">
        <GlobalSearch />
        <NotificationPopover />
        <ThemeToggle />
        <Dropdown trigger={['click']} menu={{ items: menuItems }}>
          <button type="button" className="af-topbar-user af-account-menu" aria-label="Menu tài khoản">
            <Avatar className="af-avatar">{initialsOf(staff?.name ?? 'A')}</Avatar>
            <div className="af-topbar-user-text">
              <strong>{staff?.name ?? 'Quản trị viên'}</strong>
              <small>{staff?.roleName ?? 'Quản trị viên'}</small>
            </div>
            <ChevronDown size={14} aria-hidden />
          </button>
        </Dropdown>
      </div>
    </header>
  )
}
