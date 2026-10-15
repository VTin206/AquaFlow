import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Droplets,
  Ellipsis,
  FileBarChart,
  Filter,
  LayoutDashboard,
  ImagePlus,
  MapPin,
  Menu,
  Package,
  PackageSearch,
  PackagePlus,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  Waves,
  X,
} from 'lucide-react'

type Section = 'overview' | 'orders' | 'inventory' | 'products' | 'customers' | 'delivery' | 'reports'
type OrderStatus = 'Chờ xác nhận' | 'Đang chuẩn bị' | 'Đang giao' | 'Đã hoàn tất'
type Order = { id: string; customer: string; phone: string; address: string; items: string; total: number; time: string; status: OrderStatus; method: string }
type Product = { id: string; name: string; brand: string; unit: string; stock: number; threshold: number; price: number; expiry: string; sku: string; image?: string }
type ModalKind = 'order' | 'stock' | null

const initialOrders: Order[] = [
  { id: 'AF-1048', customer: 'Nguyễn Văn An', phone: '0903 456 128', address: 'Phường Thảo Điền, TP. Thủ Đức', items: '2 bình 20L, 1 thùng 500ml', total: 185000, time: '09:42', status: 'Đang giao', method: 'Giao tận nơi' },
  { id: 'AF-1047', customer: 'Cửa hàng Minh Tâm', phone: '0918 220 467', address: 'Đường Nguyễn Văn Linh, Quận 7', items: '10 bình 20L', total: 1200000, time: '09:28', status: 'Đã hoàn tất', method: 'Giao tận nơi' },
  { id: 'AF-1046', customer: 'Trần Thị Hương', phone: '0938 113 602', address: 'Phường 6, Quận 3', items: '1 bình 20L + vỏ bình', total: 95000, time: '09:16', status: 'Chờ xác nhận', method: 'Giao tận nơi' },
  { id: 'AF-1045', customer: 'Văn phòng Green Hub', phone: '028 3822 8855', address: 'Đường Điện Biên Phủ, Bình Thạnh', items: '5 thùng chai 500ml', total: 450000, time: '08:54', status: 'Đang chuẩn bị', method: 'Giao tận nơi' },
  { id: 'AF-1044', customer: 'Lê Hoàng Phúc', phone: '0908 772 351', address: 'Khách nhận tại cửa hàng', items: '3 bình 20L', total: 210000, time: '08:31', status: 'Đã hoàn tất', method: 'Tại quầy' },
]

const initialProducts: Product[] = [
  { id: 'P-001', name: 'Nước tinh khiết bình 20L', brand: 'AquaFlow', unit: 'Bình', stock: 12, threshold: 20, price: 70000, expiry: '12/08/2027', sku: 'AQUA-20L' },
  { id: 'P-002', name: 'Vỏ bình 20L', brand: 'Dùng luân chuyển', unit: 'Vỏ', stock: 28, threshold: 35, price: 50000, expiry: '—', sku: 'VO-20L' },
  { id: 'P-003', name: 'Nước chai 500ml (24 chai)', brand: 'AquaFlow', unit: 'Thùng', stock: 64, threshold: 24, price: 90000, expiry: '02/03/2027', sku: 'AQUA-500' },
  { id: 'P-004', name: 'Nước tinh khiết bình 19L', brand: 'Lavie', unit: 'Bình', stock: 36, threshold: 18, price: 65000, expiry: '18/05/2027', sku: 'LAVIE-19L' },
  { id: 'P-005', name: 'Nước chai 1.5L (12 chai)', brand: 'AquaFlow', unit: 'Thùng', stock: 18, threshold: 20, price: 108000, expiry: '21/01/2027', sku: 'AQUA-15L' },
]

const customers = [
  { name: 'Nguyễn Văn An', phone: '0903 456 128', area: 'Thảo Điền, TP. Thủ Đức', orders: 28, balance: '2 vỏ bình', initials: 'NA' },
  { name: 'Cửa hàng Minh Tâm', phone: '0918 220 467', area: 'Quận 7', orders: 64, balance: '0 vỏ bình', initials: 'MT' },
  { name: 'Trần Thị Hương', phone: '0938 113 602', area: 'Quận 3', orders: 12, balance: '1 vỏ bình', initials: 'TH' },
  { name: 'Văn phòng Green Hub', phone: '028 3822 8855', area: 'Bình Thạnh', orders: 19, balance: '5 vỏ bình', initials: 'GH' },
  { name: 'Lê Hoàng Phúc', phone: '0908 772 351', area: 'Phú Nhuận', orders: 8, balance: '0 vỏ bình', initials: 'LP' },
]

const navGroups: { label: string; items: { id: Section; label: string; icon: typeof LayoutDashboard }[] }[] = [
  { label: 'TỔNG QUAN', items: [{ id: 'overview', label: 'Tổng quan', icon: LayoutDashboard }] },
  { label: 'VẬN HÀNH', items: [{ id: 'orders', label: 'Đơn hàng', icon: ShoppingBag }, { id: 'inventory', label: 'Kho hàng', icon: Boxes }, { id: 'products', label: 'Sản phẩm', icon: Package }, { id: 'delivery', label: 'Giao hàng', icon: Truck }] },
  { label: 'ĐỐI TÁC', items: [{ id: 'customers', label: 'Khách hàng', icon: Users }] },
  { label: 'PHÂN TÍCH', items: [{ id: 'reports', label: 'Báo cáo', icon: FileBarChart }] },
]

const sectionCopy: Record<Section, { title: string; description: string }> = {
  overview: { title: 'Tổng quan', description: 'Theo dõi nhanh tình hình hoạt động của cửa hàng.' },
  orders: { title: 'Đơn hàng', description: 'Tiếp nhận, chuẩn bị và theo dõi đơn hàng.' },
  inventory: { title: 'Kho hàng', description: 'Theo dõi số lượng tồn, lô hàng và hạn sử dụng.' },
  products: { title: 'Sản phẩm', description: 'Quản lý danh mục và giá bán hiện tại.' },
  customers: { title: 'Khách hàng', description: 'Thông tin liên hệ, lịch sử mua và số vỏ đang giữ.' },
  delivery: { title: 'Giao hàng', description: 'Theo dõi chuyến giao và kết quả giao nhận.' },
  reports: { title: 'Báo cáo', description: 'Tổng hợp bán hàng, doanh thu và tình hình kho.' },
}

const currency = (amount: number) => `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`

function App() {
  const [section, setSection] = useState<Section>('overview')
  const [orders, setOrders] = useState(initialOrders)
  const [products, setProducts] = useState(initialProducts)
  const [query, setQuery] = useState('')
  const [orderFilter, setOrderFilter] = useState('Tất cả trạng thái')
  const [modal, setModal] = useState<ModalKind>(null)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const [orderForm, setOrderForm] = useState({ customer: '', product: 'Nước tinh khiết bình 20L', quantity: 1 })
  const [stockForm, setStockForm] = useState({ productId: 'P-001', quantity: 1 })
  const [productForm, setProductForm] = useState({ name: '', brand: '', sku: '', unit: 'Bình', price: 0, stock: 0, image: '' })

  useEffect(() => {
    fetch('/api/v1/health').then((response) => setApiOnline(response.ok)).catch(() => setApiOnline(false))
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

  const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const hour = new Date().getHours()
  const greeting = hour < 11 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'

  const changeStatus = (id: string) => {
    setOrders((current) => current.map((order) => order.id !== id ? order : { ...order, status: order.status === 'Chờ xác nhận' ? 'Đang chuẩn bị' : order.status === 'Đang chuẩn bị' ? 'Đang giao' : 'Đã hoàn tất' }))
    setNotice(`Đã cập nhật trạng thái đơn ${id}.`)
  }

  const createOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const product = products.find((item) => item.name === orderForm.product)
    if (!product || product.stock < orderForm.quantity) {
      setNotice('Tồn kho không đủ để tạo đơn hàng này.')
      return
    }
    const newOrder: Order = {
      id: `AF-${1050 + orders.length}`,
      customer: orderForm.customer.trim(),
      phone: 'Chưa cập nhật',
      address: 'Chưa có địa chỉ giao hàng',
      items: `${orderForm.quantity} ${product.unit.toLowerCase()} ${product.name}`,
      total: product.price * orderForm.quantity,
      time: new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
      status: 'Chờ xác nhận',
      method: 'Giao tận nơi',
    }
    setOrders((current) => [newOrder, ...current])
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, stock: item.stock - orderForm.quantity } : item))
    setSection('orders')
    setModal(null)
    setOrderForm({ customer: '', product: 'Nước tinh khiết bình 20L', quantity: 1 })
    setNotice(`Đã tạo đơn ${newOrder.id}.`)
  }

  const receiveStock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const product = products.find((item) => item.id === stockForm.productId)
    setProducts((current) => current.map((item) => item.id === stockForm.productId ? { ...item, stock: item.stock + stockForm.quantity } : item))
    setModal(null)
    setNotice(`Đã nhập thêm ${stockForm.quantity} ${product?.unit.toLowerCase()} ${product?.name}.`)
  }

  const selectProductImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotice('Vui lòng chọn một tệp hình ảnh.')
      event.currentTarget.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice('Ảnh cần có dung lượng dưới 5 MB.')
      event.currentTarget.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => setProductForm((current) => ({ ...current, image: typeof reader.result === 'string' ? reader.result : '' }))
    reader.readAsDataURL(file)
  }

  const createProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const product: Product = {
      id: `P-${String(products.length + 1).padStart(3, '0')}`,
      name: productForm.name.trim(),
      brand: productForm.brand.trim() || 'AquaFlow',
      sku: productForm.sku.trim(),
      unit: productForm.unit,
      price: productForm.price,
      stock: productForm.stock,
      threshold: 10,
      expiry: '—',
      image: productForm.image || undefined,
    }
    setProducts((current) => [product, ...current])
    setProductForm({ name: '', brand: '', sku: '', unit: 'Bình', price: 0, stock: 0, image: '' })
    setProductModalOpen(false)
    setNotice(`Đã thêm sản phẩm ${product.name}.`)
  }

  const title = sectionCopy[section]
  const pageAction = section === 'orders' ? <button className="button button-primary" onClick={() => setModal('order')}><Plus size={17} /> Tạo đơn hàng</button>
    : section === 'inventory' ? <button className="button button-primary" onClick={() => setModal('stock')}><PackagePlus size={17} /> Tạo phiếu nhập</button>
      : section === 'products' ? <button className="button button-primary" onClick={() => setProductModalOpen(true)}><Plus size={17} /> Thêm sản phẩm</button>
        : section === 'customers' ? <button className="button button-primary" onClick={() => setNotice('Biểu mẫu khách hàng sẽ được kết nối với API trong bước tiếp theo.')}><Plus size={17} /> Thêm khách hàng</button>
          : section === 'reports' ? <button className="button button-secondary" onClick={() => setNotice('Báo cáo đã sẵn sàng để xuất.')}><ArrowDownRight size={16} /> Xuất báo cáo</button> : null

  return (
    <div className="app-shell">
      {menuOpen && <button className="mobile-scrim" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Waves size={21} strokeWidth={2.4} /></div><div><strong>AquaFlow</strong><span>QUẢN LÝ ĐẠI LÝ NƯỚC</span></div><button className="icon-button sidebar-close" aria-label="Đóng menu" onClick={() => setMenuOpen(false)}><X size={18} /></button></div>
        <div className="store-switch"><div className="store-avatar"><Droplets size={17} /></div><div><strong>Đại lý AquaFlow</strong><span>Chi nhánh chính</span></div><ChevronDown size={16} /></div>
        <nav className="main-nav" aria-label="Điều hướng chính">
          {navGroups.map((group) => <div className="nav-group" key={group.label}><p className="nav-label">{group.label}</p>{group.items.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${section === id ? 'active' : ''}`} onClick={() => { setSection(id); setMenuOpen(false) }}><Icon size={18} strokeWidth={1.9} /><span>{label}</span>{id === 'orders' && <span className="nav-count">{orders.filter((order) => order.status === 'Chờ xác nhận').length.toString().padStart(2, '0')}</span>}</button>)}</div>)}
        </nav>
        <div className="sidebar-bottom"><div className="api-status"><i className={`status-dot ${apiOnline === null ? 'checking' : apiOnline ? 'online' : 'offline'}`} /><span>{apiOnline === null ? 'Đang kiểm tra kết nối' : apiOnline ? 'Hệ thống đang hoạt động' : 'Đang dùng dữ liệu mẫu'}</span></div><button className="nav-item settings-link" onClick={() => setNotice('Cài đặt cửa hàng sẽ được bổ sung trong giai đoạn tiếp theo.')}><Settings2 size={18} /> Cài đặt</button><div className="user-profile"><div className="user-avatar">NA</div><div className="user-details"><strong>Nguyễn An</strong><span>Quản trị viên</span></div><button className="profile-more" aria-label="Tùy chọn tài khoản" onClick={() => setNotice('Tài khoản Nguyễn An')}><Ellipsis size={19} /></button></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="heading-area"><button className="icon-button mobile-menu" aria-label="Mở menu" onClick={() => setMenuOpen(true)}><Menu size={19} /></button><div className="breadcrumb">AquaFlow <ChevronRight size={13} /> <span>{title.title}</span></div><div className="page-heading"><h1>{section === 'overview' ? `${greeting}, Nguyễn An` : title.title}<span className="wave-emoji">{section === 'overview' ? ' 👋' : ''}</span></h1><p>{section === 'overview' ? 'Đây là những gì đang diễn ra tại cửa hàng của bạn hôm nay.' : title.description}</p></div></div><div className="topbar-actions">{pageAction}<div className="date-chip"><CalendarDays size={16} /><span>{today}</span></div><button className="icon-button notification-button" aria-label="Thông báo" onClick={() => setNotice('Bạn đã xem hết thông báo mới.')}><Bell size={18} /><i /></button><div className="topbar-divider" /><div className="top-user"><div className="user-avatar">NA</div><ChevronDown size={15} /></div></div></header>

        {section === 'overview' && <Dashboard orders={orders} products={products} onNavigate={setSection} onCreateOrder={() => setModal('order')} onReceiveStock={() => setModal('stock')} onChangeStatus={changeStatus} />}
        {section === 'orders' && <OrdersPage orders={filteredOrders} query={query} setQuery={setQuery} orderFilter={orderFilter} setOrderFilter={setOrderFilter} onChangeStatus={changeStatus} />}
        {section === 'inventory' && <InventoryPage products={products} query={query} setQuery={setQuery} onReceiveStock={() => setModal('stock')} />}
        {section === 'products' && <ProductsPage products={products} query={query} setQuery={setQuery} />}
        {section === 'customers' && <CustomersPage query={query} setQuery={setQuery} />}
        {section === 'delivery' && <DeliveryPage orders={orders} onChangeStatus={changeStatus} />}
        {section === 'reports' && <ReportsPage orders={orders} products={products} />}
        <footer className="page-footer"><span>© 2026 AquaFlow</span><span><i className={`tiny-dot ${apiOnline ? 'green' : ''}`} /> Dữ liệu được cập nhật theo thời gian thực</span><button onClick={() => setNotice('Trung tâm trợ giúp AquaFlow')}>Trợ giúp</button></footer>
      </main>

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><span className="eyebrow">{modal === 'order' ? 'BÁN HÀNG' : 'QUẢN LÝ KHO'}</span><h2 id="modal-title">{modal === 'order' ? 'Tạo đơn hàng mới' : 'Tạo phiếu nhập kho'}</h2></div><button className="icon-button" aria-label="Đóng" onClick={() => setModal(null)}><X size={18} /></button></div>{modal === 'order' ? <form onSubmit={createOrder}><label>Tên khách hàng<input required autoFocus placeholder="Ví dụ: Nguyễn Văn An" value={orderForm.customer} onChange={(event) => setOrderForm({ ...orderForm, customer: event.target.value })} /></label><label>Sản phẩm<select value={orderForm.product} onChange={(event) => setOrderForm({ ...orderForm, product: event.target.value })}>{products.filter((product) => product.id !== 'P-002').map((product) => <option key={product.id} value={product.name}>{product.name} · {currency(product.price)}</option>)}</select></label><label>Số lượng<input type="number" min="1" required value={orderForm.quantity} onChange={(event) => setOrderForm({ ...orderForm, quantity: Math.max(1, Number(event.target.value)) })} /></label><div className="modal-note"><ShoppingCart size={16} /> Đơn mới sẽ ở trạng thái Chờ xác nhận và giữ số lượng tương ứng trong kho.</div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Hủy</button><button type="submit" className="button button-primary"><Plus size={16} /> Tạo đơn</button></div></form> : <form onSubmit={receiveStock}><label>Sản phẩm nhập<select value={stockForm.productId} onChange={(event) => setStockForm({ ...stockForm, productId: event.target.value })}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Số lượng thực nhận<input type="number" min="1" required value={stockForm.quantity} onChange={(event) => setStockForm({ ...stockForm, quantity: Math.max(1, Number(event.target.value)) })} /></label><div className="modal-note"><PackagePlus size={16} /> Số lượng tồn sẽ được cập nhật sau khi xác nhận phiếu nhập.</div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Hủy</button><button type="submit" className="button button-primary"><Check size={16} /> Xác nhận nhập</button></div></form>}</section></div>}
      {productModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProductModalOpen(false) }}><section className="modal-card product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><div className="modal-header"><div><span className="eyebrow">DANH MỤC HÀNG HÓA</span><h2 id="product-modal-title">Thêm sản phẩm</h2></div><button className="icon-button" aria-label="Đóng" onClick={() => setProductModalOpen(false)}><X size={18} /></button></div><form onSubmit={createProduct}><label className="upload-label">Ảnh sản phẩm<div className={`image-upload ${productForm.image ? 'has-image' : ''}`}>{productForm.image ? <img src={productForm.image} alt="Ảnh xem trước sản phẩm" /> : <span className="image-upload-empty"><ImagePlus size={22} /><strong>Chọn ảnh sản phẩm</strong><small>PNG, JPG hoặc WEBP · tối đa 5 MB</small></span>}<input type="file" accept="image/*" onChange={selectProductImage} /></div></label><div className="product-form-grid"><label>Tên sản phẩm<input required autoFocus placeholder="Ví dụ: Nước tinh khiết bình 20L" value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label><label>Mã sản phẩm<input required placeholder="Ví dụ: AQUA-20L" value={productForm.sku} onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })} /></label><label>Thương hiệu<input placeholder="Ví dụ: AquaFlow" value={productForm.brand} onChange={(event) => setProductForm({ ...productForm, brand: event.target.value })} /></label><label>Đơn vị<select value={productForm.unit} onChange={(event) => setProductForm({ ...productForm, unit: event.target.value })}><option>Bình</option><option>Thùng</option><option>Chai</option><option>Vỏ</option></select></label><label>Giá bán (₫)<input type="number" min="0" required value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: Math.max(0, Number(event.target.value)) })} /></label><label>Số lượng tồn<input type="number" min="0" required value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: Math.max(0, Number(event.target.value)) })} /></label></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setProductModalOpen(false)}>Hủy</button><button type="submit" className="button button-primary"><Plus size={16} /> Lưu sản phẩm</button></div></form></section></div>}
      {notice && <div className="toast"><span className="toast-icon"><Check size={15} /></span>{notice}<button aria-label="Đóng thông báo" onClick={() => setNotice('')}><X size={15} /></button></div>}
    </div>
  )
}

function Dashboard({ orders, products, onNavigate, onCreateOrder, onReceiveStock, onChangeStatus }: { orders: Order[]; products: Product[]; onNavigate: (section: Section) => void; onCreateOrder: () => void; onReceiveStock: () => void; onChangeStatus: (id: string) => void }) {
  const pending = orders.filter((order) => order.status === 'Chờ xác nhận').length
  const revenue = orders.filter((order) => order.status === 'Đã hoàn tất').reduce((sum, order) => sum + order.total, 0) + 7620000
  const lowStock = products.filter((product) => product.stock <= product.threshold)
  return <div className="page-content">
    <section className="welcome-banner"><div className="welcome-copy"><span className="banner-kicker"><span className="sparkle">✳</span> BẢN TIN VẬN HÀNH <span className="banner-date">· Hôm nay</span></span><h2>Cửa hàng đang vận hành tốt.</h2><p>Bạn có <strong>{pending} đơn hàng mới</strong> cần xác nhận và <strong>{orders.filter((order) => order.status === 'Đang giao').length} chuyến giao</strong> đang được xử lý.</p><button className="banner-link" onClick={() => onNavigate('orders')}>Xem hoạt động hôm nay <ArrowRight size={15} /></button></div><div className="banner-art"><div className="art-circle art-circle-one" /><div className="art-circle art-circle-two" /><div className="art-bottle"><div className="bottle-cap" /><div className="bottle-neck" /><div className="bottle-body"><Waves size={38} /></div></div><div className="art-drop drop-one" /><div className="art-drop drop-two" /></div></section>
    <section className="stats-grid"><StatCard label="Doanh thu hôm nay" value={currency(revenue)} delta="12,8%" detail="so với hôm qua" icon={CircleDollarSign} tone="mint" trend="up" /><StatCard label="Đơn hàng mới" value={`${(orders.length + 19).toString().padStart(2, '0')}`} delta="8,2%" detail="so với hôm qua" icon={ShoppingBag} tone="lavender" trend="up" /><StatCard label="Đang giao hàng" value="08" delta="03 đơn" detail="đang giao trễ" icon={Truck} tone="peach" trend="warning" /><StatCard label="Sản phẩm sắp hết" value={lowStock.length.toString().padStart(2, '0')} delta="Cần nhập thêm" detail="kiểm tra tồn kho" icon={PackageSearch} tone="yellow" trend="warning" /></section>
    <div className="dashboard-grid"><section className="surface sales-panel"><div className="section-head"><div><span className="eyebrow">HIỆU SUẤT KINH DOANH</span><h2>Doanh thu bán hàng</h2></div><button className="select-button" onClick={() => onNavigate('reports')}>7 ngày qua <ChevronDown size={14} /></button></div><div className="chart-summary"><strong>{currency(revenue)}</strong><span className="trend-chip"><ArrowUpRight size={14} /> 12,8%</span><span className="chart-caption">so với tuần trước</span></div><div className="chart"><div className="chart-y-labels"><span>3tr</span><span>2tr</span><span>1tr</span><span>0</span></div><div className="chart-plot"><div className="chart-gridline line-one" /><div className="chart-gridline line-two" /><div className="chart-gridline line-three" /><div className="chart-bars">{[{ d: 'T2', h: 42 }, { d: 'T3', h: 60 }, { d: 'T4', h: 50 }, { d: 'T5', h: 74 }, { d: 'T6', h: 57 }, { d: 'T7', h: 87 }, { d: 'CN', h: 68 }].map((item, index) => <div className="chart-column" key={item.d}><div className={`bar ${index === 5 ? 'bar-highlight' : ''}`} style={{ height: `${item.h}%` }}><span>{index === 5 ? '2,6tr' : ''}</span></div><span className="bar-label">{item.d}</span></div>)}</div></div></div><div className="chart-footnote"><span><i className="legend-dot" /> Doanh thu</span><span>Cập nhật lần cuối: 10:42 hôm nay</span></div></section>
      <section className="surface inventory-panel"><div className="section-head"><div><span className="eyebrow">CẦN THEO DÕI</span><h2>Tồn kho cần chú ý</h2></div><button className="text-link" onClick={() => onNavigate('inventory')}>Chi tiết <ArrowRight size={14} /></button></div><div className="stock-alert-list">{lowStock.slice(0, 3).map((product) => <StockAlert key={product.id} product={product} />)}{lowStock.length === 0 && <div className="empty-inline"><Check size={18} /> Tồn kho đang ở mức an toàn.</div>}</div><button className="button button-outline full-button" onClick={onReceiveStock}><Plus size={16} /> Tạo phiếu nhập kho</button></section></div>
    <section className="surface recent-orders"><div className="section-head"><div><span className="eyebrow">CẬP NHẬT MỚI NHẤT</span><h2>Đơn hàng gần đây</h2></div><button className="text-link" onClick={() => onNavigate('orders')}>Xem tất cả <ArrowRight size={14} /></button></div><OrderTable orders={orders.slice(0, 4)} onChangeStatus={onChangeStatus} compact /></section>
    <div className="quick-actions"><button onClick={onCreateOrder}><span className="quick-icon teal"><ShoppingCart size={17} /></span><span><strong>Tạo đơn hàng</strong><small>Ghi nhận đơn mới</small></span><ChevronRight size={16} /></button><button onClick={onReceiveStock}><span className="quick-icon blue"><PackagePlus size={17} /></span><span><strong>Nhập hàng</strong><small>Cập nhật lượng tồn</small></span><ChevronRight size={16} /></button><button onClick={() => onNavigate('delivery')}><span className="quick-icon orange"><Truck size={17} /></span><span><strong>Điều phối giao</strong><small>Quản lý chuyến giao</small></span><ChevronRight size={16} /></button><button onClick={() => onNavigate('reports')}><span className="quick-icon purple"><FileBarChart size={17} /></span><span><strong>Xem báo cáo</strong><small>Phân tích cửa hàng</small></span><ChevronRight size={16} /></button></div>
  </div>
}

function StatCard({ label, value, delta, detail, icon: Icon, tone, trend }: { label: string; value: string; delta: string; detail: string; icon: typeof CircleDollarSign; tone: string; trend: 'up' | 'warning' }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} strokeWidth={2} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small className={trend === 'up' ? 'positive' : 'warning'}>{trend === 'up' ? <ArrowUpRight size={12} /> : <Activity size={12} />}{delta} <em>{detail}</em></small></div><button className="stat-more" aria-label={`Xem ${label}`}><Ellipsis size={18} /></button></article>
}

function StockAlert({ product }: { product: Product }) {
  const percent = Math.min(100, product.stock / (product.threshold * 2) * 100)
  return <div className="stock-alert"><div className="product-symbol"><Droplets size={17} /></div><div className="stock-alert-copy"><div className="stock-alert-title"><div><strong>{product.name}</strong><small>{product.sku}</small></div><b className={product.stock <= product.threshold * 0.7 ? 'danger' : 'caution'}>{product.stock} {product.unit.toLowerCase()}</b></div><div className="progress-track"><i className={product.stock <= product.threshold * 0.7 ? 'danger' : 'caution'} style={{ width: `${percent}%` }} /></div></div></div>
}

function OrdersPage({ orders, query, setQuery, orderFilter, setOrderFilter, onChangeStatus }: { orders: Order[]; query: string; setQuery: (value: string) => void; orderFilter: string; setOrderFilter: (value: string) => void; onChangeStatus: (id: string) => void }) {
  return <div className="page-content subpage-content"><div className="surface data-surface"><div className="toolbar"><div className="toolbar-copy"><strong>Danh sách đơn hàng</strong><span>{orders.length} đơn đang hiển thị</span></div><div className="toolbar-controls"><SearchField value={query} onChange={setQuery} placeholder="Tìm mã đơn, khách hàng..." /><label className="filter-select"><Filter size={15} /><select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}><option>Tất cả trạng thái</option><option>Chờ xác nhận</option><option>Đang chuẩn bị</option><option>Đang giao</option><option>Đã hoàn tất</option></select><ChevronDown size={14} /></label></div></div><OrderTable orders={orders} onChangeStatus={onChangeStatus} /></div><div className="table-footer"><span>Đang hiển thị <strong>{orders.length}</strong> đơn hàng</span><div className="pagination"><button aria-label="Trang trước"><ChevronLeft size={16} /></button><button className="current-page">1</button><button>2</button><button>3</button><span>…</span><button>12</button><button aria-label="Trang sau"><ChevronRight size={16} /></button></div></div></div>
}

function OrderTable({ orders, onChangeStatus, compact = false }: { orders: Order[]; onChangeStatus: (id: string) => void; compact?: boolean }) {
  return <div className="table-scroll"><table className={`data-table ${compact ? 'compact-table' : ''}`}><thead><tr><th>MÃ ĐƠN</th><th>KHÁCH HÀNG</th><th>SẢN PHẨM</th><th>THỜI GIAN</th><th>TỔNG TIỀN</th><th>TRẠNG THÁI</th><th /></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong className="order-id">#{order.id}</strong></td><td><div className="customer-cell"><span className="customer-avatar">{order.customer.split(' ').slice(-2).map((part) => part[0]).join('').toUpperCase()}</span><span><strong>{order.customer}</strong><small>{order.phone}</small></span></div></td><td className="items-cell">{order.items}</td><td><span className="time-cell"><Clock3 size={13} /> {order.time}</span></td><td><strong className="amount-cell">{currency(order.total)}</strong></td><td><StatusBadge status={order.status} /></td><td><button className="row-menu" aria-label={`Cập nhật ${order.id}`} title="Chuyển sang trạng thái tiếp theo" onClick={() => onChangeStatus(order.id)}><Ellipsis size={18} /></button></td></tr>)}</tbody></table>{orders.length === 0 && <div className="empty-state"><Search size={22} /><strong>Không tìm thấy đơn hàng</strong><span>Thử thay đổi từ khóa hoặc bộ lọc trạng thái.</span></div>}</div>
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const className = status === 'Đã hoàn tất' ? 'done' : status === 'Đang giao' ? 'shipping' : status === 'Đang chuẩn bị' ? 'preparing' : 'pending'
  return <span className={`status-badge ${className}`}><i />{status}</span>
}

function InventoryPage({ products, query, setQuery, onReceiveStock }: { products: Product[]; query: string; setQuery: (value: string) => void; onReceiveStock: () => void }) {
  const visible = products.filter((product) => `${product.name} ${product.sku} ${product.brand}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="page-content subpage-content"><div className="inventory-summary"><div className="summary-tile"><span>Tổng mã hàng</span><strong>{products.length.toString().padStart(2, '0')}</strong><small><Boxes size={13} /> đang kinh doanh</small></div><div className="summary-tile"><span>Tồn kho thấp</span><strong className="text-coral">{products.filter((item) => item.stock <= item.threshold).length.toString().padStart(2, '0')}</strong><small><Activity size={13} /> cần nhập thêm</small></div><div className="summary-tile"><span>Lô sắp hết hạn</span><strong className="text-amber">03</strong><small><Clock3 size={13} /> trong 30 ngày tới</small></div><div className="summary-tile"><span>Giá trị tồn kho</span><strong>{currency(products.reduce((sum, item) => sum + item.stock * item.price, 0))}</strong><small><CircleDollarSign size={13} /> theo giá nhập</small></div></div><div className="surface data-surface"><div className="toolbar"><div className="toolbar-copy"><strong>Danh sách tồn kho</strong><span>Theo dõi số lượng và hạn sử dụng theo lô</span></div><div className="toolbar-controls"><SearchField value={query} onChange={setQuery} placeholder="Tìm sản phẩm, mã hàng..." /><button className="button button-secondary filter-button"><Filter size={15} /> Bộ lọc</button></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>SẢN PHẨM</th><th>MÃ HÀNG</th><th>TỒN KHO</th><th>NGƯỠNG TỐI THIỂU</th><th>HẠN SỬ DỤNG GẦN NHẤT</th><th>TRẠNG THÁI</th></tr></thead><tbody>{visible.map((product) => <tr key={product.id}><td><div className="product-cell"><span className="product-symbol"><Droplets size={17} /></span><span><strong>{product.name}</strong><small>{product.brand}</small></span></div></td><td><span className="sku-cell">{product.sku}</span></td><td><strong className="stock-number">{product.stock} <small>{product.unit.toLowerCase()}</small></strong></td><td>{product.threshold} {product.unit.toLowerCase()}</td><td><span className={product.expiry !== '—' && product.expiry.startsWith('21') ? 'expiry-soon' : ''}>{product.expiry}</span></td><td><span className={`stock-state ${product.stock <= product.threshold ? 'low' : 'normal'}`}><i />{product.stock <= product.threshold ? 'Sắp hết' : 'Đủ hàng'}</span></td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state">Không có sản phẩm phù hợp.</div>}</div></div><button className="button button-outline inventory-bottom-cta" onClick={onReceiveStock}><Plus size={16} /> Tạo phiếu nhập hàng</button></div>
}

function ProductsPage({ products, query, setQuery }: { products: Product[]; query: string; setQuery: (value: string) => void }) {
  const visible = products.filter((product) => `${product.name} ${product.sku} ${product.brand}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="page-content subpage-content"><div className="surface data-surface"><div className="toolbar"><div className="toolbar-copy"><strong>Danh mục sản phẩm</strong><span>{products.length} sản phẩm đang kinh doanh</span></div><div className="toolbar-controls"><SearchField value={query} onChange={setQuery} placeholder="Tìm tên hoặc mã sản phẩm..." /><button className="button button-secondary filter-button"><Filter size={15} /> Danh mục <ChevronDown size={14} /></button></div></div><div className="product-grid">{visible.map((product, index) => <article className="product-card" key={product.id}><div className={`product-art art-tone-${index % 4}`}>{product.image ? <img className="uploaded-product-image" src={product.image} alt={product.name} /> : <div className="mini-bottle"><i /><span><Waves size={20} /></span></div>}<button className="product-more" aria-label="Tùy chọn sản phẩm"><Ellipsis size={19} /></button><span className="product-category">{product.brand}</span></div><div className="product-card-copy"><span className="sku-cell">{product.sku}</span><h3>{product.name}</h3><div className="product-card-bottom"><strong>{currency(product.price)} <small>/ {product.unit.toLowerCase()}</small></strong><span className={product.stock <= product.threshold ? 'low-text' : 'stock-text'}>{product.stock} còn kho</span></div></div></article>)}</div>{visible.length === 0 && <div className="empty-state">Không có sản phẩm phù hợp.</div>}</div></div>
}

function CustomersPage({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  const visible = customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.area}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="page-content subpage-content"><div className="customer-summary"><div className="summary-tile"><span>Tổng khách hàng</span><strong>248</strong><small><Users size={13} /> hồ sơ khách hàng</small></div><div className="summary-tile"><span>Khách hàng mới</span><strong>18</strong><small><ArrowUpRight size={13} /> trong tháng này</small></div><div className="summary-tile"><span>Vỏ bình đang lưu</span><strong>136</strong><small><Boxes size={13} /> từ khách hàng</small></div></div><div className="surface data-surface"><div className="toolbar"><div className="toolbar-copy"><strong>Danh sách khách hàng</strong><span>Thông tin mua hàng và đối soát vỏ bình</span></div><div className="toolbar-controls"><SearchField value={query} onChange={setQuery} placeholder="Tìm tên, số điện thoại..." /><button className="button button-secondary filter-button"><Filter size={15} /> Bộ lọc</button></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>KHÁCH HÀNG</th><th>KHU VỰC</th><th>ĐƠN HÀNG</th><th>VỎ ĐANG GIỮ</th><th>LIÊN HỆ</th><th /></tr></thead><tbody>{visible.map((customer) => <tr key={customer.phone}><td><div className="customer-cell"><span className="customer-avatar">{customer.initials}</span><span><strong>{customer.name}</strong><small>Khách hàng thân thiết</small></span></div></td><td><span className="location-cell"><MapPin size={13} />{customer.area}</span></td><td><strong>{customer.orders}</strong> đơn</td><td><span className="bottle-balance"><Boxes size={14} />{customer.balance}</span></td><td>{customer.phone}</td><td><button className="row-menu" aria-label={`Tùy chọn ${customer.name}`}><Ellipsis size={18} /></button></td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state">Không tìm thấy khách hàng.</div>}</div></div></div>
}

function DeliveryPage({ orders, onChangeStatus }: { orders: Order[]; onChangeStatus: (id: string) => void }) {
  const deliveries = orders.filter((order) => order.method === 'Giao tận nơi' && order.status !== 'Đã hoàn tất')
  return <div className="page-content subpage-content"><div className="delivery-overview"><div className="delivery-stat"><span className="delivery-stat-icon teal"><Truck size={19} /></span><div><small>Đơn cần giao</small><strong>{deliveries.length + 4}</strong></div></div><div className="delivery-stat"><span className="delivery-stat-icon green"><Check size={19} /></span><div><small>Đã giao thành công</small><strong>16</strong></div></div><div className="delivery-stat"><span className="delivery-stat-icon amber"><Clock3 size={19} /></span><div><small>Giao trễ</small><strong>03</strong></div></div><div className="delivery-stat"><span className="delivery-stat-icon purple"><Users size={19} /></span><div><small>Nhân viên giao hàng</small><strong>04 <small>đang hoạt động</small></strong></div></div></div><div className="surface data-surface"><div className="toolbar"><div className="toolbar-copy"><strong>Đơn hàng đang giao</strong><span>Chuyến giao trong ngày · 15/10/2026</span></div><button className="button button-secondary" onClick={() => window.print()}><FileBarChart size={15} /> In danh sách</button></div><div className="delivery-list">{deliveries.map((order, index) => <article className="delivery-row" key={order.id}><div className="route-time"><span className={`route-indicator ${index === 0 ? 'active' : ''}`} /><strong>{index === 0 ? 'Đang giao' : 'Tiếp theo'}</strong><small>{order.time}</small></div><div className="route-line"><i /></div><div className="delivery-order"><div className="delivery-order-top"><div><span className="order-id">#{order.id}</span><StatusBadge status={order.status} /></div><strong>{currency(order.total)}</strong></div><h3>{order.customer}</h3><p><MapPin size={14} />{order.address}</p><div className="delivery-order-bottom"><span><Package size={14} />{order.items}</span><span><Truck size={14} /> Trần Quốc Bảo</span><button className="text-link" onClick={() => onChangeStatus(order.id)}>{order.status === 'Đang giao' ? 'Xác nhận giao' : 'Bắt đầu giao'} <ArrowRight size={14} /></button></div></div></article>)}{deliveries.length === 0 && <div className="empty-state">Chưa có đơn giao đang xử lý.</div>}</div></div></div>
}

function ReportsPage({ orders, products }: { orders: Order[]; products: Product[] }) {
  const gross = orders.reduce((sum, order) => sum + order.total, 0)
  return <div className="page-content subpage-content"><div className="report-filter surface"><div><strong>Báo cáo hoạt động</strong><span>Dữ liệu minh họa cho cửa hàng</span></div><button className="select-button"><CalendarDays size={15} /> Tháng 10, 2026 <ChevronDown size={14} /></button></div><div className="report-stat-grid"><div className="report-stat surface"><span>Doanh thu thuần</span><strong>{currency(gross + 7620000)}</strong><small className="positive"><ArrowUpRight size={13} /> 12,8% so với kỳ trước</small></div><div className="report-stat surface"><span>Đơn hàng hoàn tất</span><strong>{orders.filter((order) => order.status === 'Đã hoàn tất').length + 84}</strong><small className="positive"><ArrowUpRight size={13} /> 8,4% so với kỳ trước</small></div><div className="report-stat surface"><span>Giá trị đơn trung bình</span><strong>{currency(286000)}</strong><small className="positive"><ArrowUpRight size={13} /> 3,2% so với kỳ trước</small></div></div><div className="report-grid"><section className="surface report-chart"><div className="section-head"><div><span className="eyebrow">TỔNG QUAN DOANH THU</span><h2>Doanh thu theo ngày</h2></div><div className="legend"><i /> Doanh thu</div></div><div className="report-bars">{[48, 61, 55, 77, 67, 88, 70, 82, 59, 76, 91, 72].map((height, i) => <div className="report-bar-col" key={i}><i style={{ height: `${height}%` }} /><span>{i + 1}</span></div>)}</div></section><section className="surface report-stock"><div className="section-head"><div><span className="eyebrow">HÀNG HÓA</span><h2>Tồn kho hiện tại</h2></div></div>{products.slice(0, 4).map((product) => <div className="report-stock-row" key={product.id}><span>{product.name}</span><strong>{product.stock} {product.unit.toLowerCase()}</strong><i className={product.stock <= product.threshold ? 'is-low' : ''} /></div>)}</section></div></div>
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search-field"><Search size={16} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><kbd>⌘ K</kbd></label>
}

export default App
