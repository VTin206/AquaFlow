import { App, Avatar, Badge, Button, Tooltip } from 'antd'
import { Bell, Menu as MenuIcon, Waves } from 'lucide-react'
import { Link } from 'react-router'
import { useApiOnline } from '../shared/api/health'

/** Thanh trên cùng mang màu thương hiệu: logo, chi nhánh, trạng thái kết nối, thông báo, tài khoản. */
export function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const { message } = App.useApp()
  const apiOnline = useApiOnline()

  return (
    <header className="af-topbar">
      <div className="af-topbar-left">
        <Button type="text" className="af-topbar-icon af-nav-toggle" aria-label="Mở menu" icon={<MenuIcon size={20} />} onClick={onOpenNav} />
        <Link to="/" className="af-topbar-brand">
          <span className="af-brand-mark">
            <Waves size={18} strokeWidth={2.2} />
          </span>
          <strong>AquaFlow</strong>
        </Link>
        <span className="af-topbar-divider" aria-hidden />
        <span className="af-topbar-store">Chi nhánh chính</span>
      </div>
      <div className="af-topbar-right">
        <span className={`af-api-pill ${apiOnline ? 'online' : 'offline'}`} title={apiOnline ? 'Đã kết nối máy chủ' : 'Đang dùng dữ liệu mẫu'}>
          <i />
          {apiOnline === undefined ? 'Đang kiểm tra' : apiOnline ? 'Đã kết nối' : 'Dữ liệu mẫu'}
        </span>
        <Tooltip title="Thông báo">
          <Badge dot offset={[-8, 8]} color="#c92a2a">
            <Button type="text" shape="circle" className="af-topbar-icon" aria-label="Thông báo" icon={<Bell size={18} />} onClick={() => message.info('Bạn đã xem hết thông báo mới.')} />
          </Badge>
        </Tooltip>
        <div className="af-topbar-user">
          <Avatar className="af-avatar">NA</Avatar>
          <div className="af-topbar-user-text">
            <strong>Nguyễn An</strong>
            <small>Quản trị viên</small>
          </div>
        </div>
      </div>
    </header>
  )
}
