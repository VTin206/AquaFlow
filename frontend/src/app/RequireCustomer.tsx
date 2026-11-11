import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/features/auth/useAuth'
import { accountDestination, isCustomer } from '@/features/auth/accountAccess'

export function RequireCustomer() {
  const { isAuthenticated, user, restoring } = useAuth()
  const location = useLocation()
  // Đang xin access token mới bằng cookie refresh: chờ kết quả, không đẩy về trang đăng nhập rồi lại quay về.
  if (restoring) return null
  if (!isAuthenticated) return <Navigate to="/shop/account" replace state={{ from: location.pathname }} />
  if (!isCustomer(user) && !user?.isDemo) return <Navigate to={accountDestination(user)} replace />
  return <Outlet />
}
