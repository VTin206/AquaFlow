import type { AuthUser } from './authContext'
import { canOpen, homeOf, roleOfUser } from './permissions'
import { roleLabel, STAFF_ROLES } from './roles'

export const isCustomer = (user: AuthUser | null) => user?.role === 'CUSTOMER' || user?.role === roleLabel('CUSTOMER')
export const isStaff = (user: AuthUser | null) =>
  Boolean(user && (STAFF_ROLES.some((role) => user.role === role || user.role === roleLabel(role)) || user.role === 'Chủ cửa hàng'))

/** Trang cửa hàng khách quay lại được sau khi đăng nhập (kèm query, ví dụ bộ lọc sản phẩm); trang đăng ký thì không. */
const CUSTOMER_RETURN = /^\/(?:shop(?:\/(?!register(?:[/?#]|$))[^?#]*)?|checkout|track(?:\/[^/?#]+)?)(?:\?[^#]*)?$/

/** Only accept a local destination that belongs to the signed-in workspace. */
export function accountDestination(user: AuthUser | null, requested = '/') {
  if (isCustomer(user)) {
    if (requested === '/') return '/shop'
    return CUSTOMER_RETURN.test(requested) ? requested : '/shop/orders'
  }
  if (!user || !isStaff(user)) return '/shop/account'
  const staffPaths = [
    '/',
    '/orders',
    '/inventory',
    '/delivery',
    '/driver',
    '/products',
    '/suppliers',
    '/customers',
    '/reports',
    '/activity',
    '/settings',
    '/staff',
  ]
  if (staffPaths.includes(requested) && canOpen(roleOfUser(user), requested)) return requested
  return homeOf(roleOfUser(user))
}

/** Trang chỉ xem được khi đã đăng nhập; đăng xuất tại đây thì không ở lại được. */
export const isSignedInOnlyPage = (pathname: string) => /^\/shop\/orders(?:\/|$)/.test(pathname)

/**
 * State gửi kèm khi mở trang đăng nhập/đăng ký để đăng nhập xong quay lại đúng trang đang xem.
 * Đang ở chính trang đăng nhập/đăng ký thì giữ trang gốc đã mang theo từ trước.
 */
export function loginReturnState(location: { pathname: string; search: string; state?: unknown }) {
  const carried = (location.state as { from?: unknown } | null)?.from
  if (/^\/shop\/(?:account|register)\/?$/.test(location.pathname)) return typeof carried === 'string' ? { from: carried } : undefined
  return { from: location.pathname + location.search }
}
