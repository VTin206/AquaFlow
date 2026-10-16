import { type ReactNode, useEffect, useState } from 'react'
import { Button, Layout } from 'antd'
import { ArrowDownRight, PackagePlus, Plus } from 'lucide-react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import type { ToastTone } from './components/Toast'
import { OrderModal } from './components/OrderModal'
import { ProductModal } from './components/ProductModal'
import { StockModal } from './components/StockModal'
import { Toast } from './components/Toast'
import { sectionCopy, sectionFromPath, sectionPaths } from './config/navigation'
import { useAdvanceOrderStatus, useCreateOrder, useOrders } from './hooks/useOrders'
import { useCreateProduct, useProducts, useReceiveStock } from './hooks/useProducts'
import { CustomersPage } from './pages/CustomersPage'
import { DashboardPage } from './pages/DashboardPage'
import { DeliveryPage } from './pages/DeliveryPage'
import { InventoryPage } from './pages/InventoryPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductsPage } from './pages/ProductsPage'
import { ReportsPage } from './pages/ReportsPage'
import { getHealth } from './services/health'
import type { OrderDraft, ProductDraft, Section, StockDraft } from './types'

type ModalKind = 'order' | 'stock' | 'product' | null

function App() {
  const location = useLocation()
  const navigateTo = useNavigate()
  const section = sectionFromPath(location.pathname)
  const { data: orders = [] } = useOrders()
  const { data: products = [] } = useProducts()
  const createOrderMutation = useCreateOrder()
  const advanceStatusMutation = useAdvanceOrderStatus()
  const createProductMutation = useCreateProduct()
  const receiveStockMutation = useReceiveStock()
  const [modal, setModal] = useState<ModalKind>(null)
  const [notice, setToast] = useState<{ message: string; tone: ToastTone } | null>(null)
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)

  useEffect(() => {
    getHealth().then((health) => setApiOnline(health.status === 'UP')).catch(() => setApiOnline(false))
  }, [])

  useEffect(() => {
    document.title = `${sectionCopy[section].title} | AquaFlow`
  }, [section])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setToast(null), notice.tone === 'error' ? 5000 : 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  const setNotice = (message: string, tone: ToastTone = 'success') => setToast(message ? { message, tone } : null)
  const showError = (error: Error) => setNotice(error.message, 'error')

  const pendingCount = orders.filter((order) => order.status === 'Chờ xác nhận').length
  const closeModal = () => setModal(null)

  const navigate = (next: Section) => navigateTo(sectionPaths[next])

  const changeStatus = (id: string) =>
    advanceStatusMutation.mutate(id, {
      onSuccess: (order) => setNotice(`Đơn ${order.id} chuyển sang "${order.status}".`),
      onError: showError,
    })

  const createOrder = (draft: OrderDraft) =>
    createOrderMutation.mutate(draft, {
      onSuccess: (order) => {
        navigate('orders')
        closeModal()
        setNotice(`Đã tạo đơn ${order.id}.`)
      },
      onError: showError,
    })

  const receiveStock = (draft: StockDraft) =>
    receiveStockMutation.mutate(draft, {
      onSuccess: (product) => {
        closeModal()
        setNotice(`Đã nhập thêm ${draft.quantity} ${product.unit.toLowerCase()} ${product.name}.`)
      },
      onError: showError,
    })

  const createProduct = (draft: ProductDraft) =>
    createProductMutation.mutate(draft, {
      onSuccess: (product) => {
        closeModal()
        setNotice(`Đã thêm sản phẩm ${product.name}.`)
      },
      onError: showError,
    })

  const pageActions: Partial<Record<Section, ReactNode>> = {
    orders: <Button type="primary" icon={<Plus size={16} />} onClick={() => setModal('order')}>Tạo đơn hàng</Button>,
    inventory: <Button type="primary" icon={<PackagePlus size={16} />} onClick={() => setModal('stock')}>Tạo phiếu nhập</Button>,
    products: <Button type="primary" icon={<Plus size={16} />} onClick={() => setModal('product')}>Thêm sản phẩm</Button>,
    customers: <Button type="primary" icon={<Plus size={16} />} onClick={() => setNotice('Biểu mẫu khách hàng sẽ được kết nối với API trong bước tiếp theo.')}>Thêm khách hàng</Button>,
    reports: <Button icon={<ArrowDownRight size={16} />} onClick={() => setNotice('Báo cáo đã sẵn sàng để xuất.')}>Xuất báo cáo</Button>,
  }

  return (
    <Layout className="af-shell">
      <Sidebar pendingCount={pendingCount} apiOnline={apiOnline} onNotice={setNotice} />

      <Layout>
        <Topbar section={section} action={pageActions[section] ?? null} onNotice={setNotice} />

        <Layout.Content className="af-content">
        <Routes>
          <Route path={sectionPaths.overview} element={<DashboardPage orders={orders} products={products} onNavigate={navigate} onCreateOrder={() => setModal('order')} onReceiveStock={() => setModal('stock')} onChangeStatus={changeStatus} />} />
          <Route path={sectionPaths.orders} element={<OrdersPage onChangeStatus={changeStatus} />} />
          <Route path={sectionPaths.inventory} element={<InventoryPage onReceiveStock={() => setModal('stock')} />} />
          <Route path={sectionPaths.products} element={<ProductsPage />} />
          <Route path={sectionPaths.customers} element={<CustomersPage />} />
          <Route path={sectionPaths.delivery} element={<DeliveryPage onChangeStatus={changeStatus} />} />
          <Route path={sectionPaths.reports} element={<ReportsPage orders={orders} products={products} />} />
          <Route path="*" element={<Navigate to={sectionPaths.overview} replace />} />
        </Routes>

        </Layout.Content>
      </Layout>

      {modal === 'order' && <OrderModal products={products} submitting={createOrderMutation.isPending} onSubmit={createOrder} onClose={closeModal} />}
      {modal === 'stock' && <StockModal products={products} submitting={receiveStockMutation.isPending} onSubmit={receiveStock} onClose={closeModal} />}
      {modal === 'product' && <ProductModal submitting={createProductMutation.isPending} onSubmit={createProduct} onClose={closeModal} onNotice={setNotice} />}
      {notice && <Toast message={notice.message} tone={notice.tone} onClose={() => setToast(null)} />}
    </Layout>
  )
}

export default App
