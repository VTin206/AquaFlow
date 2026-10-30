import { useState } from 'react'
import { Avatar, Button, Popover } from 'antd'
import { LayoutDashboard, LogOut, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { useStaff } from '../../auth/useStaff'

/** Icon tài khoản trên đầu trang khách: chưa đăng nhập thì mở khung đăng nhập, đã đăng nhập thì xem thông tin tài khoản. */
export function AccountMenu({ onLogin }: { onLogin: () => void }) {
  const { isAuthenticated, user, logout } = useAuth()
  // Tên vai trò lấy giống thanh trên của trang quản lý.
  const staff = useStaff()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const go = (to: string) => { setOpen(false); navigate(to) }
  const icon = <UserRound size={20} />

  if (!isAuthenticated || !user) {
    return <Button type="text" shape="circle" icon={icon} aria-label="Đăng nhập" title="Đăng nhập" onClick={onLogin} />
  }

  const content = (
    <div className="af-shop-account">
      <div className="af-shop-account-head">
        <Avatar size={44} className="af-avatar">{user.name.trim().charAt(0).toUpperCase()}</Avatar>
        <div>
          <strong>{user.name}</strong>
          {user.email && <small>{user.email}</small>}
          <small>{staff ? `${staff.roleName}${staff.isDemo ? ' · dùng thử' : ''}` : user.role}</small>
        </div>
      </div>
      <Button block type="primary" icon={<LayoutDashboard size={16} />} onClick={() => go('/')}>Trang quản lý</Button>
      <Button block danger icon={<LogOut size={16} />} onClick={() => { logout(); go('/shop') }}>Đăng xuất</Button>
    </div>
  )

  return (
    <Popover content={content} trigger="click" placement="bottomRight" open={open} onOpenChange={setOpen} arrow={false}>
      <Button type="text" shape="circle" icon={icon} aria-label="Tài khoản" title="Tài khoản" />
    </Popover>
  )
}
