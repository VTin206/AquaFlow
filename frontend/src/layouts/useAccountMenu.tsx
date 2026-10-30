import { useEffect } from 'react'
import { App, type MenuProps } from 'antd'
import { Check, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { setColorMode, useColorMode, type ColorMode } from '../app/colorMode'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { roleNames, type RoleCode } from '../features/auth/permissions'
import { useAuth } from '../features/auth/useAuth'
import { devAccounts, type DevAccount } from '../features/auth/devAccounts'
import { setDemoRole, useStaff, type Staff } from '../features/auth/useStaff'
import { setMockSession } from '../mocks/session'

/** Mục trong menu tài khoản, dùng chung cho khung quản lý và khung giao hàng. */
export function useAccountMenuItems(): MenuProps['items'] {
  const { user, logout, login, enterDemo } = useAuth()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const staff = useStaff()
  const navigate = useNavigate()
  const { selected: colorMode } = useColorMode()
  const modes: [ColorMode, string, typeof Sun][] = [['light', 'Sáng', Sun], ['dark', 'Tối', Moon], ['system', 'Theo máy', Monitor]]
  // Giao diện sáng/tối: dấu ✓ đánh dấu lựa chọn hiện tại.
  const themeItems: MenuProps['items'] = [
    {
      type: 'group',
      key: 'theme',
      label: 'Giao diện',
      children: modes.map(([value, label, Icon]) => ({
        key: `theme:${value}`,
        icon: <Icon size={16} />,
        label: <span className="af-menu-check">{label}{colorMode === value && <Check size={14} aria-hidden />}</span>,
        onClick: () => setColorMode(value),
      })),
    },
    { type: 'divider' },
  ]
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
    // Không liệt kê tài khoản đang đăng nhập.
    ...devAccounts.filter((account) => account.email.toLowerCase() !== user?.email?.toLowerCase()).map((account) => ({
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
  const logoutItem = { key: 'logout', danger: true, icon: <LogOut size={16} />, label: 'Đăng xuất', onClick: () => { logout(); navigate('/shop', { replace: true }) } }
  // Bản dùng thử: đổi vai trò để xem menu và quyền của từng nhân viên.
  return staff?.isDemo
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
        ...themeItems,
        ...switchItems,
        logoutItem,
      ]
    : [...themeItems, ...switchItems, logoutItem]
}

/** Dữ liệu mẫu ghi tên và kiểm tra quyền theo nhân viên đang dùng, giống backend đọc từ JWT. */
export function useMockSession(staff: Staff | null) {
  const staffName = staff?.name
  const staffRole = staff?.role
  useEffect(() => {
    if (staffName && staffRole) setMockSession({ name: staffName, role: staffRole })
  }, [staffName, staffRole])
}

export const initialsOf = (name: string) => name.split(/\s+/).map((part) => part[0]).slice(-2).join('').toUpperCase()
