import { useState } from 'react'
import { App, Avatar, Button, Popover } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, LogOut, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router'
import { devAccounts, type DevAccount } from '@/features/auth/devAccounts'
import { useAuth } from '@/features/auth/useAuth'
import { useStaff } from '@/features/auth/useStaff'

/**
 * Tài khoản trên đầu trang khách, có hai chỗ: chữ trên thanh trên cùng ("Đăng nhập" / "Chào, …") và icon trên header.
 * Chưa đăng nhập thì bấm sang trang tài khoản, đã đăng nhập thì mở thông tin tài khoản.
 */
export function AccountMenu({ variant = 'icon' }: { variant?: 'icon' | 'text' }) {
  const { isAuthenticated, user, logout, login, enterDemo, enterDemoGuest } = useAuth()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  // Tên vai trò lấy giống thanh trên của trang quản lý.
  const staff = useStaff()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }
  const icon = <UserRound size={24} />

  if (!isAuthenticated || !user) {
    return variant === 'text' ? (
      <>
        <Button type="link" className="af-shop-topbar-link" onClick={() => navigate('/shop/account')}>
          Đăng nhập
        </Button>
        <Button type="link" className="af-shop-topbar-link af-shop-topbar-register" onClick={() => navigate('/shop/register')}>
          Tạo tài khoản
        </Button>
      </>
    ) : (
      <Button type="text" shape="circle" icon={icon} aria-label="Đăng nhập" title="Đăng nhập" onClick={() => navigate('/shop/account')} />
    )
  }

  // Dev: đổi tài khoản mà vẫn ở trang đang xem, để so cửa hàng dữ liệu thật với bản dùng thử; xóa cache để không lẫn dữ liệu.
  const switchTo = async (account: DevAccount) => {
    setOpen(false)
    try {
      await login(account)
      queryClient.clear()
      message.success(`Đã chuyển sang ${account.label}.`)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Đăng nhập thất bại.')
    }
  }
  const switchToDemo = () => {
    setOpen(false)
    enterDemo()
    queryClient.clear()
  }
  const switchToDemoGuest = () => {
    setOpen(false)
    enterDemoGuest()
    queryClient.clear()
  }
  const otherAccounts = devAccounts.filter((account) => account.email.toLowerCase() !== user.email?.toLowerCase())
  const showSwitch = import.meta.env.DEV

  const content = (
    <div className="af-shop-account">
      <div className="af-shop-account-head">
        <Avatar size={44} className="af-avatar">
          {user.name.trim().charAt(0).toUpperCase()}
        </Avatar>
        <div>
          <strong>{user.name}</strong>
          {user.email && <small>{user.email}</small>}
          <small>{staff ? `${staff.roleName}${staff.isDemo ? ' · dùng thử' : ''}` : user.role}</small>
        </div>
      </div>
      <Button block type="primary" icon={<LayoutDashboard size={16} />} onClick={() => go('/')}>
        Trang quản lý
      </Button>
      {showSwitch && (
        <div className="af-shop-account-switch">
          <small>Đổi tài khoản (dev)</small>
          {!user.isDemo && (
            <Button block size="small" onClick={switchToDemo}>
              Bản dùng thử
            </Button>
          )}
          <Button block size="small" title="Dữ liệu mẫu, chưa đăng nhập" onClick={switchToDemoGuest}>
            Xem như khách (dữ liệu mẫu)
          </Button>
          {otherAccounts.map((account) => (
            <Button key={account.email} block size="small" title={account.email} onClick={() => void switchTo(account)}>
              {account.label}
            </Button>
          ))}
        </div>
      )}
      <Button
        block
        danger
        icon={<LogOut size={16} />}
        onClick={() => {
          logout()
          go('/shop')
        }}
      >
        Đăng xuất
      </Button>
    </div>
  )

  return (
    <Popover content={content} trigger="click" placement="bottomRight" open={open} onOpenChange={setOpen} arrow={false}>
      {variant === 'text' ? (
        <Button type="link" className="af-shop-topbar-link" title="Tài khoản">
          <span className="af-shop-greeting">Chào, {givenName(user.name)}</span>
        </Button>
      ) : (
        <Button type="text" shape="circle" icon={icon} aria-label="Tài khoản" title="Tài khoản" />
      )}
    </Popover>
  )
}

/** Tên gọi theo kiểu Việt: chữ cuối của họ tên ("Nguyễn Văn An" → "An"). */
function givenName(name: string) {
  return name.trim().split(/\s+/).pop() || name
}
