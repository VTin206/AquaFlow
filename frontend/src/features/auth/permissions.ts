import type { AuthUser } from './authContext'

/** Mã vai trò nhân viên, khớp bảng roles ở backend. */
export type RoleCode = 'ADMIN' | 'SALES_STAFF' | 'DELIVERY_STAFF'

export const roleNames: Record<RoleCode, string> = {
  ADMIN: 'Chủ cửa hàng',
  SALES_STAFF: 'Nhân viên bán hàng',
  DELIVERY_STAFF: 'Nhân viên giao hàng',
}

// Tài khoản thật có thể lưu mã (ADMIN) hoặc tên vai trò đã dịch, nên nhận cả hai.
const byLabel: Record<string, RoleCode> = {
  'quản trị viên': 'ADMIN',
  'chủ cửa hàng': 'ADMIN',
  'nhân viên bán hàng': 'SALES_STAFF',
  'nhân viên giao hàng': 'DELIVERY_STAFF',
}

/** Vai trò không nhận ra thì dùng quyền thấp nhất của nhân viên văn phòng. */
export function roleOfUser(user: Pick<AuthUser, 'role'>): RoleCode {
  const raw = user.role.trim()
  if (raw in roleNames) return raw as RoleCode
  return byLabel[raw.toLowerCase()] ?? 'SALES_STAFF'
}

const pageRoles: Record<string, RoleCode[]> = {
  '/': ['ADMIN', 'SALES_STAFF'],
  '/orders': ['ADMIN', 'SALES_STAFF'],
  '/inventory': ['ADMIN', 'SALES_STAFF'],
  '/delivery': ['ADMIN', 'SALES_STAFF'],
  '/driver': ['ADMIN', 'DELIVERY_STAFF'],
  '/products': ['ADMIN', 'SALES_STAFF'],
  '/suppliers': ['ADMIN', 'SALES_STAFF'],
  '/customers': ['ADMIN', 'SALES_STAFF'],
  '/reports': ['ADMIN'],
  '/activity': ['ADMIN'],
  '/settings': ['ADMIN'],
}

export const canOpen = (role: RoleCode, path: string) => (pageRoles[path] ?? ['ADMIN']).includes(role)

/** Trang mở đầu tiên sau khi đăng nhập. */
export const homeOf = (role: RoleCode) => (role === 'DELIVERY_STAFF' ? '/driver' : '/')

/** Thao tác cần quyền riêng trong một trang. Backend vẫn phải kiểm tra lại. */
const actionRoles = {
  /** Hoàn tiền, nhận trả hàng: ảnh hưởng doanh thu nên chỉ chủ cửa hàng duyệt. */
  refund: ['ADMIN'],
  cancelOrder: ['ADMIN', 'SALES_STAFF'],
  createOrder: ['ADMIN', 'SALES_STAFF'],
  /** Báo mất/vỡ, hoàn cọc làm đổi sổ cọc. */
  adjustBottles: ['ADMIN'],
} satisfies Record<string, RoleCode[]>

export type GuardedAction = keyof typeof actionRoles

export const can = (role: RoleCode, action: GuardedAction) => (actionRoles[action] as RoleCode[]).includes(role)
