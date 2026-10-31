import { useSyncExternalStore } from 'react'
import { drivers } from '@/features/delivery/types'
import { roleNames, roleOfUser, type RoleCode } from './permissions'
import { useAuth } from './useAuth'

// Bản dùng thử không có tài khoản thật nên cho đổi vai trò để xem giao diện của từng người.
const DEMO_ROLE_KEY = 'aquaflow.demo-role'

/** Người dùng mẫu cho từng vai trò; tài xế trùng tên trong danh sách chuyến mẫu. */
const demoNames: Record<RoleCode, string> = { ADMIN: 'Nguyễn An', SALES_STAFF: 'Lê Thu Trang', DELIVERY_STAFF: drivers[0] }

const readDemoRole = (): RoleCode => {
  try {
    const stored = localStorage.getItem(DEMO_ROLE_KEY)
    return stored && stored in roleNames ? (stored as RoleCode) : 'ADMIN'
  } catch {
    return 'ADMIN'
  }
}

let demoRole = readDemoRole()
const listeners = new Set<() => void>()

export function setDemoRole(role: RoleCode) {
  demoRole = role
  try {
    localStorage.setItem(DEMO_ROLE_KEY, role)
  } catch {
    // Bỏ qua khi trình duyệt chặn bộ nhớ.
  }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export type Staff = { name: string; role: RoleCode; roleName: string; isDemo: boolean }

/** Nhân viên đang dùng app: tên hiển thị, vai trò để ẩn/hiện trang và thao tác. */
export function useStaff(): Staff | null {
  const { user } = useAuth()
  const role = useSyncExternalStore(subscribe, () => demoRole)
  if (!user) return null
  if (user.isDemo) return { name: demoNames[role], role, roleName: roleNames[role], isDemo: true }
  const real = roleOfUser(user)
  return { name: user.name, role: real, roleName: roleNames[real], isDemo: false }
}
