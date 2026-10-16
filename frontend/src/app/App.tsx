import { lazy, Suspense } from 'react'
import { Spin } from 'antd'
import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '../layouts/AppLayout'

// Mỗi trang được tải khi người dùng mở tới, giúp lần tải đầu nhẹ hơn.
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const OrdersPage = lazy(() => import('../features/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })))
const InventoryPage = lazy(() => import('../features/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })))
const ProductsPage = lazy(() => import('../features/inventory/ProductsPage').then((m) => ({ default: m.ProductsPage })))
const CustomersPage = lazy(() => import('../features/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })))
const DeliveryPage = lazy(() => import('../features/delivery/DeliveryPage').then((m) => ({ default: m.DeliveryPage })))
const ReportsPage = lazy(() => import('../features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))
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
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="delivery" element={<DeliveryPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
