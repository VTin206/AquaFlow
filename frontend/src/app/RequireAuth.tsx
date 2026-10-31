import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/features/auth/useAuth'

export function RequireAuth() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  // Khách vào trang chủ thì thấy cửa hàng; trang quản lý khác vẫn đòi đăng nhập rồi quay lại đúng trang.
  if (!isAuthenticated)
    return location.pathname === '/' ? (
      <Navigate to="/shop" replace />
    ) : (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    )
  return <Outlet />
}
