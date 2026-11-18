import { App, type MenuProps } from 'antd'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { devAccounts, type DevAccount } from '@/features/auth/devAccounts'

/** Mục trong menu tài khoản, dùng chung cho khung quản lý và khung giao hàng. */
export function useAccountMenuItems(): MenuProps['items'] {
  const { user, logout, login } = useAuth()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
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
  // Không liệt kê tài khoản đang đăng nhập.
  const switchTargets: NonNullable<MenuProps['items']> = devAccounts
    .filter((account) => account.email.toLowerCase() !== user?.email?.toLowerCase())
    .map((account) => ({
      key: `switch:${account.email}`,
      label: account.label,
      title: account.email,
      onClick: () => void switchTo(account),
    }))
  const switchItems: MenuProps['items'] =
    import.meta.env.DEV && switchTargets.length
      ? [{ type: 'group', key: 'switch', label: 'Đổi tài khoản (dev)', children: switchTargets }, { type: 'divider' }]
      : []
  const logoutItem = {
    key: 'logout',
    danger: true,
    icon: <LogOut size={16} />,
    label: 'Đăng xuất',
    onClick: () => {
      logout()
      navigate('/shop', { replace: true })
    },
  }
  return [...switchItems, logoutItem]
}

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(-2)
    .join('')
    .toUpperCase()
