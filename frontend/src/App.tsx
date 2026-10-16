import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, PackagePlus, Plus } from 'lucide-react'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { OrderModal } from './components/OrderModal'
import { ProductModal } from './components/ProductModal'
import { StockModal } from './components/StockModal'
import { Toast } from './components/Toast'
import { initialOrders, initialProducts } from './mocks/data'
import { CustomersPage } from './pages/CustomersPage'
import { DashboardPage } from './pages/DashboardPage'
import { DeliveryPage } from './pages/DeliveryPage'
import { InventoryPage } from './pages/InventoryPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductsPage } from './pages/ProductsPage'
import { ReportsPage } from './pages/ReportsPage'
import { getHealth } from './services/health'
import type { Order, OrderDraft, Product, ProductDraft, Section, StockDraft } from './types'

type ModalKind = 'order' | 'stock' | 'product' | null

function App() {
  const [section, setSection] = useState<Section>('overview')
  const [orders, setOrders] = useState(initialOrders)
  const [products, setProducts] = useState(initialProducts)
  const [query, setQuery] = useState('')
  const [orderFilter, setOrderFilter] = useState('Tất cả trạng thái')
  const [modal, setModal] = useState<ModalKind>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)

  useEffect(() => {
    getHealth().then((health) => setApiOnline(health.status === 'UP')).catch(() => setApiOnline(false))
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const matchesQuery = `${order.id} ${order.customer} ${order.phone} ${order.items}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (orderFilter === 'Tất cả trạng thái' || order.status === orderFilter)
  }), [orders, orderFilter, query])

  const pendingCount = orders.filter((order) => order.status === 'Chờ xác nhận').length
  const closeModal = () => setModal(null)

  const navigate = (next: Section) => {
    setSection(next)
    setMenuOpen(false)
  }

  const changeStatus = (id: string) => {
    setOrders((current) => current.map((order) => order.id !== id ? order : { ...order, status: order.status === 'Chờ xác nhận' ? 'Đang chuẩn bị' : order.status === 'Đang chuẩn bị' ? 'Đang giao' : 'Đã hoàn tất' }))
    setNotice(`Đã cập nhật trạng thái đơn ${id}.`)
  }

  const createOrder = (draft: OrderDraft) => {
    const product = products.find((item) => item.name === draft.product)
    if (!product || product.stock < draft.quantity) {
      setNotice('Tồn kho không đủ để tạo đơn hàng này.')
      return
    }
    const newOrder: Order = {
      id: `AF-${1050 + orders.length}`,
      customer: draft.customer.trim(),
      phone: 'Chưa cập nhật',
      address: 'Chưa có địa chỉ giao hàng',
      items: `${draft.quantity} ${product.unit.toLowerCase()} ${product.name}`,
      total: product.price * draft.quantity,
      time: new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
      status: 'Chờ xác nhận',
      method: 'Giao tận nơi',
    }
    setOrders((current) => [newOrder, ...current])
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, stock: item.stock - draft.quantity } : item))
    setSection('orders')
    closeModal()
    setNotice(`Đã tạo đơn ${newOrder.id}.`)
  }

  const receiveStock = (draft: StockDraft) => {
    const product = products.find((item) => item.id === draft.productId)
    setProducts((current) => current.map((item) => item.id === draft.productId ? { ...item, stock: item.stock + draft.quantity } : item))
    closeModal()
    setNotice(`Đã nhập thêm ${draft.quantity} ${product?.unit.toLowerCase()} ${product?.name}.`)
  }

  const createProduct = (draft: ProductDraft) => {
    const product: Product = {
      id: `P-${String(products.length + 1).padStart(3, '0')}`,
      name: draft.name.trim(),
      brand: draft.brand.trim() || 'AquaFlow',
      sku: draft.sku.trim(),
      unit: draft.unit,
      price: draft.price,
      stock: draft.stock,
      threshold: 10,
      expiry: '—',
      image: draft.image || undefined,
    }
    setProducts((current) => [product, ...current])
    closeModal()
    setNotice(`Đã thêm sản phẩm ${product.name}.`)
  }

  const pageActions: Partial<Record<Section, ReactNode>> = {
    orders: <button className="button button-primary" onClick={() => setModal('order')}><Plus size={17} /> Tạo đơn hàng</button>,
    inventory: <button className="button button-primary" onClick={() => setModal('stock')}><PackagePlus size={17} /> Tạo phiếu nhập</button>,
    products: <button className="button button-primary" onClick={() => setModal('product')}><Plus size={17} /> Thêm sản phẩm</button>,
    customers: <button className="button button-primary" onClick={() => setNotice('Biểu mẫu khách hàng sẽ được kết nối với API trong bước tiếp theo.')}><Plus size={17} /> Thêm khách hàng</button>,
    reports: <button className="button button-secondary" onClick={() => setNotice('Báo cáo đã sẵn sàng để xuất.')}><ArrowDownRight size={16} /> Xuất báo cáo</button>,
  }

  return (
    <div className="app-shell">
      {menuOpen && <button className="mobile-scrim" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
      <Sidebar section={section} open={menuOpen} pendingCount={pendingCount} apiOnline={apiOnline} onNavigate={navigate} onClose={() => setMenuOpen(false)} onNotice={setNotice} />

      <main className="main-content">
        <Topbar section={section} action={pageActions[section] ?? null} onOpenMenu={() => setMenuOpen(true)} onNotice={setNotice} />

        {section === 'overview' && <DashboardPage orders={orders} products={products} onNavigate={setSection} onCreateOrder={() => setModal('order')} onReceiveStock={() => setModal('stock')} onChangeStatus={changeStatus} />}
        {section === 'orders' && <OrdersPage orders={filteredOrders} query={query} setQuery={setQuery} orderFilter={orderFilter} setOrderFilter={setOrderFilter} onChangeStatus={changeStatus} />}
        {section === 'inventory' && <InventoryPage products={products} query={query} setQuery={setQuery} onReceiveStock={() => setModal('stock')} />}
        {section === 'products' && <ProductsPage products={products} query={query} setQuery={setQuery} />}
        {section === 'customers' && <CustomersPage query={query} setQuery={setQuery} />}
        {section === 'delivery' && <DeliveryPage orders={orders} onChangeStatus={changeStatus} />}
        {section === 'reports' && <ReportsPage orders={orders} products={products} />}

        <footer className="page-footer">
          <span>© 2026 AquaFlow</span>
          <span><i className={`tiny-dot ${apiOnline ? 'green' : ''}`} /> Dữ liệu được cập nhật theo thời gian thực</span>
          <button onClick={() => setNotice('Trung tâm trợ giúp AquaFlow')}>Trợ giúp</button>
        </footer>
      </main>

      {modal === 'order' && <OrderModal products={products} onSubmit={createOrder} onClose={closeModal} />}
      {modal === 'stock' && <StockModal products={products} onSubmit={receiveStock} onClose={closeModal} />}
      {modal === 'product' && <ProductModal onSubmit={createProduct} onClose={closeModal} onNotice={setNotice} />}
      {notice && <Toast message={notice} onClose={() => setNotice('')} />}
    </div>
  )
}

export default App
