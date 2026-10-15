import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  Bell,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  PackageSearch,
  Truck,
  Users,
  Waves,
} from 'lucide-react'

type HealthState = 'checking' | 'online' | 'offline'

const stats = [
  { label: 'Đơn hàng hôm nay', value: '24', delta: '+12.5%', icon: ClipboardList, tone: 'teal' },
  { label: 'Doanh thu hôm nay', value: '8.420.000 ₫', delta: '+8.2%', icon: CircleDollarSign, tone: 'blue' },
  { label: 'Sản phẩm sắp hết', value: '06', delta: 'Cần nhập thêm', icon: PackageSearch, tone: 'amber' },
  { label: 'Đang giao hàng', value: '08', delta: '03 đang trễ', icon: Truck, tone: 'purple' },
]

const activities = [
  ['#DH-1048', 'Nguyễn Văn An', '2 bình 20L + 1 thùng chai 500ml', '185.000 ₫', 'Đang giao'],
  ['#DH-1047', 'Cửa hàng Minh Tâm', '10 bình 20L', '1.200.000 ₫', 'Đã hoàn tất'],
  ['#DH-1046', 'Trần Thị Hương', '1 bình 20L + vỏ bình', '95.000 ₫', 'Chờ xác nhận'],
  ['#DH-1045', 'Văn phòng Green Hub', '5 thùng chai 500ml', '450.000 ₫', 'Đang giao'],
]

function App() {
  const [health, setHealth] = useState<HealthState>('checking')

  useEffect(() => {
    fetch('/api/v1/health')
      .then((response) => {
        if (!response.ok) throw new Error('API unavailable')
        setHealth('online')
      })
      .catch(() => setHealth('offline'))
  }, [])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Waves size={22} /></div>
          <div><strong>AquaFlow</strong><span>Quản lý đại lý nước</span></div>
        </div>
        <nav className="main-nav">
          <p className="nav-label">TỔNG QUAN</p>
          <a className="nav-item active" href="#dashboard"><LayoutDashboard size={18} /> Tổng quan</a>
          <p className="nav-label">QUẢN LÝ</p>
          <a className="nav-item" href="#orders"><ClipboardList size={18} /> Đơn hàng <span className="badge">12</span></a>
          <a className="nav-item" href="#inventory"><Boxes size={18} /> Kho hàng</a>
          <a className="nav-item" href="#customers"><Users size={18} /> Khách hàng</a>
          <a className="nav-item" href="#delivery"><Truck size={18} /> Giao hàng</a>
          <a className="nav-item" href="#products"><PackageSearch size={18} /> Sản phẩm</a>
        </nav>
        <div className="sidebar-footer">
          <div className="api-status"><i className={`status-dot ${health}`} /> API {health === 'online' ? 'đang hoạt động' : health === 'offline' ? 'chưa kết nối' : 'đang kiểm tra'}</div>
          <div className="user-mini"><div className="avatar">NA</div><div><strong>Nguyễn An</strong><span>Quản trị viên</span></div><ChevronDown size={16} /></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><span className="eyebrow">THỨ TƯ, 15 THÁNG 10, 2026</span><h1>Chào buổi sáng, Nguyễn An <span>👋</span></h1></div>
          <button className="icon-button" aria-label="Thông báo"><Bell size={20} /><i /></button>
        </header>

        <section className="hero-banner">
          <div><span className="eyebrow light">BẢN TIN VẬN HÀNH</span><h2>Hôm nay cửa hàng đang vận hành tốt.</h2><p>24 đơn hàng mới và 8 chuyến giao đang được xử lý.</p></div>
          <div className="hero-wave"><Waves size={112} /></div>
        </section>

        <section className="stats-grid">
          {stats.map(({ label, value, delta, icon: Icon, tone }) => <article className="stat-card" key={label}><div className={`stat-icon ${tone}`}><Icon size={20} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small className={delta.startsWith('+') ? 'positive' : 'warning'}>{delta}</small></div><ArrowUpRight className="stat-arrow" size={17} /></article>)}
        </section>

        <section className="content-grid">
          <article className="panel orders-panel"><div className="panel-header"><div><span className="eyebrow">GẦN ĐÂY</span><h2>Đơn hàng mới nhất</h2></div><a href="#orders">Xem tất cả <ArrowUpRight size={15} /></a></div><div className="table-wrap"><table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead><tbody>{activities.map(([id, customer, product, amount, status]) => <tr key={id}><td><strong>{id}</strong></td><td>{customer}</td><td className="muted">{product}</td><td><strong>{amount}</strong></td><td><span className={`order-status ${status === 'Đã hoàn tất' ? 'done' : status === 'Chờ xác nhận' ? 'pending' : 'shipping'}`}>{status}</span></td></tr>)}</tbody></table></div></article>
          <article className="panel inventory-panel"><div className="panel-header"><div><span className="eyebrow">KHO HÀNG</span><h2>Tồn kho cần chú ý</h2></div><a href="#inventory">Chi tiết <ArrowUpRight size={15} /></a></div><div className="inventory-list"><InventoryRow name="Nước tinh khiết 20L" sku="AQUA-20L" quantity="12 bình" percent={24} tone="danger" /><InventoryRow name="Vỏ bình 20L" sku="BOTTLE-20L" quantity="28 vỏ" percent={46} tone="warning" /><InventoryRow name="Nước chai 500ml" sku="AQUA-500" quantity="64 thùng" percent={72} tone="good" /></div><button className="outline-button">+ Tạo phiếu nhập kho</button></article>
        </section>
      </main>
    </div>
  )
}

function InventoryRow({ name, sku, quantity, percent, tone }: { name: string; sku: string; quantity: string; percent: number; tone: string }) {
  return <div className="inventory-row"><div className="product-thumb"><Waves size={18} /></div><div className="inventory-copy"><div><strong>{name}</strong><span>{sku}</span></div><b className={tone}>{quantity}</b><div className="progress"><i className={tone} style={{ width: `${percent}%` }} /></div></div></div>
}

export default App
