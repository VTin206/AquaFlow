import { roleNames, roleOfUser, type RoleCode } from './permissions'
import { useAuth } from './useAuth'
import { isStaff } from './accountAccess'

export type Staff = { name: string; role: RoleCode; roleName: string }

/** Nhân viên đang dùng app: tên hiển thị, vai trò để ẩn/hiện trang và thao tác. */
export function useStaff(): Staff | null {
  const { user } = useAuth()
  if (!user || !isStaff(user)) return null
  const role = roleOfUser(user)
  return { name: user.name, role, roleName: roleNames[role] }
}
