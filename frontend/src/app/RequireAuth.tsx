import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/features/auth/useAuth'
import { accountDestination, isStaff } from '@/features/auth/accountAccess'

export function RequireAuth() {
  const { isAuthenticated, user, restoring } = useAuth()
  const location = useLocation()
  // Đang xin access token mới bằng cookie refresh: chờ kết quả, không đẩy về trang đăng nhập rồi lại quay về.
  if (restoring) return null

  // Khách vào trang chủ thì thấy cửa hàng; trang quản lý khác vẫn đòi đăng nhập rồi quay lại đúng trang.
  if (!isAuthenticated)
    return location.pathname === '/' ? (
      <Navigate to="/shop" replace />
    ) : (
      <Navigate to="/shop/account" replace state={{ from: location.pathname }} />
    )
  if (!isStaff(user)) return <Navigate to={accountDestination(user)} replace />
  return <Outlet />
}
