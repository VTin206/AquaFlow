import { lazy, Suspense } from 'react'
import { Spin } from 'antd'
import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '../layouts/AppLayout'
import { RequireAuth } from './RequireAuth'

// Mỗi trang được tải khi người dùng mở tới, giúp lần tải đầu nhẹ hơn.
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const OrdersPage = lazy(() => import('../features/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })))
const InventoryPage = lazy(() => import('../features/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })))
const ProductsPage = lazy(() => import('../features/inventory/ProductsPage').then((m) => ({ default: m.ProductsPage })))
const CustomersPage = lazy(() => import('../features/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })))
const SuppliersPage = lazy(() => import('../features/suppliers/SuppliersPage').then((m) => ({ default: m.SuppliersPage })))
const DeliveryPage = lazy(() => import('../features/delivery/DeliveryPage').then((m) => ({ default: m.DeliveryPage })))
const ReportsPage = lazy(() => import('../features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const DriverPage = lazy(() => import('../features/delivery/DriverPage').then((m) => ({ default: m.DriverPage })))
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const ActivityPage = lazy(() => import('../features/activity/ActivityPage').then((m) => ({ default: m.ActivityPage })))
const ShopLayout = lazy(() => import('../features/shop/ShopLayout').then((m) => ({ default: m.ShopLayout })))
const ShopPage = lazy(() => import('../features/shop/ShopPage').then((m) => ({ default: m.ShopPage })))
const TrackPage = lazy(() => import('../features/shop/TrackPage').then((m) => ({ default: m.TrackPage })))
const LoginPage = lazy(() => import('../features/auth/LoginPage').then((m) => ({ default: m.LoginPage })))

const pageFallback = (
  <div className="af-page-loading">
    <Spin size="large" />

  </div>
)

export function App() {
  return (
    <Suspense fallback={pageFallback}>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        {/* Trang công khai cho khách đặt hàng và tra cứu đơn, không cần đăng nhập. */}
        <Route element={<ShopLayout />}>
          <Route path="shop" element={<ShopPage />} />
          <Route path="track" element={<TrackPage />} />
          <Route path="track/:token" element={<TrackPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="delivery" element={<DeliveryPage />} />
            <Route path="driver" element={<DriverPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
