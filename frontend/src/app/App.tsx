import { lazy, Suspense, type ReactNode } from 'react'
import { Spin } from 'antd'
import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '../layouts/AppLayout'
import { RequireAuth } from './RequireAuth'
import { useAuth } from '../features/auth/useAuth'

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
const ProductDetailPage = lazy(() => import('../features/shop/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })))
const CheckoutPage = lazy(() => import('../features/shop/CheckoutPage').then((m) => ({ default: m.CheckoutPage })))
const LiveOrdersPage = lazy(() => import('../features/live/LiveOrdersPage').then((m) => ({ default: m.LiveOrdersPage })))
const TrackPage = lazy(() => import('../features/shop/TrackPage').then((m) => ({ default: m.TrackPage })))
const LoginPage = lazy(() => import('../features/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const LivePages = lazy(() => import('../features/live/LiveSprintOnePages').then((m) => ({ default: m.LiveProductsPage })))
const LiveSuppliersPage = lazy(() => import('../features/live/LiveSprintOnePages').then((m) => ({ default: m.LiveSuppliersPage })))
const LiveCustomersPage = lazy(() => import('../features/live/LiveSprintOnePages').then((m) => ({ default: m.LiveCustomersPage })))
const UnavailablePage = lazy(() => import('../features/live/UnavailablePage').then((m) => ({ default: m.UnavailablePage })))

function SprintOneMode({ demo, live }: { demo: ReactNode; live: ReactNode }) {
  const { user } = useAuth()
  return user?.isDemo ? demo : live
}

function DemoOnly({ demo }: { demo: ReactNode }) {
  const { user } = useAuth()
  return user?.isDemo ? demo : <UnavailablePage />
}

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
          <Route path="shop/products/:id" element={<ProductDetailPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="track" element={<TrackPage />} />
          <Route path="track/:token" element={<TrackPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<DemoOnly demo={<DashboardPage />} />} />
            <Route path="orders" element={<SprintOneMode demo={<OrdersPage />} live={<LiveOrdersPage />} />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="products" element={<SprintOneMode demo={<ProductsPage />} live={<LivePages />} />} />
            <Route path="customers" element={<SprintOneMode demo={<CustomersPage />} live={<LiveCustomersPage />} />} />
            <Route path="suppliers" element={<SprintOneMode demo={<SuppliersPage />} live={<LiveSuppliersPage />} />} />
            <Route path="delivery" element={<DemoOnly demo={<DeliveryPage />} />} />
            <Route path="driver" element={<DemoOnly demo={<DriverPage />} />} />
            <Route path="reports" element={<DemoOnly demo={<ReportsPage />} />} />
            <Route path="activity" element={<DemoOnly demo={<ActivityPage />} />} />
            <Route path="settings" element={<DemoOnly demo={<SettingsPage />} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
