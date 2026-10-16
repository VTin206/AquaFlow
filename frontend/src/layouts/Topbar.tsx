import { Avatar, Button, Dropdown } from 'antd'
import { ChevronDown, LogOut, Menu as MenuIcon, Store, Waves } from 'lucide-react'
import { Link } from 'react-router'
import { NotificationPopover } from './NotificationPopover'

/** Thanh ứng dụng và các thao tác nhanh. */
export function Topbar({ onOpenNav }: { onOpenNav: () => void }) {

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
        <span className="af-topbar-store">
          <Store size={16} /> Một cửa hàng · Một kho
        </span>
      </div>
      <div className="af-topbar-right">
        <span className="af-demo-label">Dữ liệu mẫu</span>
        <NotificationPopover />
        <Dropdown trigger={['click']} menu={{ items: [{ key: 'logout', danger: true, icon: <LogOut size={16} />, label: <Link to="/login">Đăng xuất</Link> }] }}>
          <button type="button" className="af-topbar-user af-account-menu" aria-label="Menu tài khoản">
            <Avatar className="af-avatar">NA</Avatar>
            <div className="af-topbar-user-text">
              <strong>Nguyễn An</strong>
              <small>Quản trị viên</small>
            </div>
            <ChevronDown size={14} aria-hidden />
          </button>
        </Dropdown>
      </div>
    </header>
  )
}
