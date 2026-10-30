import { lazy, Suspense, type ReactNode } from 'react'
import { Spin } from 'antd'
import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '../layouts/AppLayout'
import { DriverLayout } from '../layouts/DriverLayout'
import { ThemedArea } from '../layouts/ThemedArea'
import { RequireAuth } from './RequireAuth'
import { usePageSupported } from '../shared/features'

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
const ArticlePage = lazy(() => import('../features/shop/ArticlePage').then((m) => ({ default: m.ArticlePage })))
const ShopAccountPage = lazy(() => import('../features/shop/ShopAccountPage').then((m) => ({ default: m.ShopAccountPage })))
const ShopRegisterPage = lazy(() => import('../features/shop/ShopAccountPage').then((m) => ({ default: m.ShopRegisterPage })))
const ShopPage = lazy(() => import('../features/shop/ShopPage').then((m) => ({ default: m.ShopPage })))
const ProductDetailPage = lazy(() => import('../features/shop/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })))
const CheckoutPage = lazy(() => import('../features/shop/CheckoutPage').then((m) => ({ default: m.CheckoutPage })))
const TrackPage = lazy(() => import('../features/shop/TrackPage').then((m) => ({ default: m.TrackPage })))
const LoginPage = lazy(() => import('../features/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('../features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const UnavailablePage = lazy(() => import('../features/live/UnavailablePage').then((m) => ({ default: m.UnavailablePage })))

/** Trang chưa có API BE: tài khoản thật vẫn mở được nhưng thấy "Chưa hỗ trợ" thay cho dữ liệu mẫu. */
function BackendPage({ path, title, children }: { path: string; title: string; children: ReactNode }) {
  return usePageSupported()(path) ? children : <UnavailablePage title={title} />
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
        <Route path="register" element={<RegisterPage />} />
        {/* Trang công khai cho khách đặt hàng và tra cứu đơn, không cần đăng nhập. */}
        <Route element={<ShopLayout />}>
          <Route path="shop" element={<ShopPage />} />
          <Route path="shop/products/:id" element={<ProductDetailPage />} />
          <Route path="shop/news/:slug" element={<ArticlePage />} />
          <Route path="shop/account" element={<ShopAccountPage />} />
          <Route path="shop/register" element={<ShopRegisterPage />} />
          <Route path="shop/policy/:slug" element={<ArticlePage key="policy" kind="policy" />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="track" element={<TrackPage />} />
          <Route path="track/:token" element={<TrackPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<ThemedArea><AppLayout /></ThemedArea>}>
            <Route index element={<BackendPage path="/" title="Tổng quan"><DashboardPage /></BackendPage>} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="delivery" element={<BackendPage path="/delivery" title="Giao hàng"><DeliveryPage /></BackendPage>} />
            <Route path="reports" element={<BackendPage path="/reports" title="Báo cáo"><ReportsPage /></BackendPage>} />
            <Route path="activity" element={<BackendPage path="/activity" title="Nhật ký"><ActivityPage /></BackendPage>} />
            <Route path="settings" element={<BackendPage path="/settings" title="Cài đặt"><SettingsPage /></BackendPage>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          {/* Nhân viên giao hàng dùng khung riêng, không vào trang quản lý. */}
          <Route element={<ThemedArea><DriverLayout /></ThemedArea>}>
            <Route path="driver" element={<BackendPage path="/driver" title="Chuyến của tôi"><DriverPage /></BackendPage>} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
