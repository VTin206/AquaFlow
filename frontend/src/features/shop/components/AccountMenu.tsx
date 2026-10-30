import { useState } from 'react'
import { Avatar, Button, Popover } from 'antd'
import { LayoutDashboard, LogIn, LogOut, MapPin, Phone, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { useStaff } from '../../auth/useStaff'
import { readProfile } from '../cart'

/** Icon tài khoản trên đầu trang khách: thông tin người đang đăng nhập, hoặc mời đăng nhập kèm địa chỉ giao đã lưu. */
export function AccountMenu() {
  const { isAuthenticated, user, logout } = useAuth()
  // Tên vai trò lấy giống thanh trên của trang quản lý.
  const staff = useStaff()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const go = (to: string) => { setOpen(false); navigate(to) }
  // Đọc lại mỗi lần mở vì khách có thể vừa lưu địa chỉ ở trang thanh toán.
  const profile = open && !isAuthenticated ? readProfile() : null

  const content = isAuthenticated && user ? (
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
  ) : (
    <div className="af-shop-account">
      <div className="af-shop-account-head">
        <Avatar size={44} icon={<UserRound size={22} />} />
        <div>
          <strong>Khách</strong>
          <small>Đặt hàng không cần tài khoản.</small>
        </div>
      </div>
      {profile && (
        <dl className="af-shop-account-profile">
          <dt>Giao lần trước</dt>
          <dd><UserRound size={14} aria-hidden /> {profile.customer}</dd>
          <dd><Phone size={14} aria-hidden /> {profile.phone}</dd>
          <dd><MapPin size={14} aria-hidden /> {[profile.address, profile.area].filter(Boolean).join(', ')}</dd>
        </dl>
      )}
      <Button block type="primary" icon={<LogIn size={16} />} onClick={() => go('/login')}>Đăng nhập</Button>
    </div>
  )

  return (
    <Popover content={content} trigger="click" placement="bottomRight" open={open} onOpenChange={setOpen} arrow={false}>
      <Button type="text" shape="circle" icon={<UserRound size={20} />} aria-label="Tài khoản" title="Tài khoản" />
    </Popover>
  )
}
