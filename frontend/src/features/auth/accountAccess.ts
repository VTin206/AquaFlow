import type { AuthUser } from './authContext'
import { canOpen, homeOf, roleOfUser } from './permissions'
import { roleLabel, STAFF_ROLES } from './roles'

export const isCustomer = (user: AuthUser | null) => !user?.isDemo && (user?.role === 'CUSTOMER' || user?.role === roleLabel('CUSTOMER'))
export const isStaff = (user: AuthUser | null) =>
  Boolean(
    user?.isDemo ||
    (user && (STAFF_ROLES.some((role) => user.role === role || user.role === roleLabel(role)) || user.role === 'Chủ cửa hàng')),
  )

/** Only accept a local destination that belongs to the signed-in workspace. */
export function accountDestination(user: AuthUser | null, requested = '/') {
  if (isCustomer(user)) {
    if (requested === '/') return '/shop'
    return /^\/shop\/orders(?:\/\d+)?$/.test(requested) || requested === '/checkout' ? requested : '/shop/orders'
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
