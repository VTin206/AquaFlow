import { useState } from 'react'
import { Alert, Badge, Button } from 'antd'
import { ArrowLeft, Clock3, PackageSearch, Phone, Search, ShoppingCart, Waves } from 'lucide-react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { useSettings } from '../settings/settingsService'
import { useCart } from './cart'
import { AccountMenu } from './components/AccountMenu'
import { CartDrawer } from './components/CartDrawer'
import { ShopFooter } from './components/ShopFooter'
import { useShopDemo } from './shopService'

// Bản thật chưa có API cài đặt công khai: hotline và giờ mở cửa tạm lấy từ biến môi trường.
const liveContact = { phone: import.meta.env.VITE_SHOP_HOTLINE, openingHours: import.meta.env.VITE_SHOP_HOURS }

/**
 * Khung trang công khai cho khách, cũng là trang chủ khi chưa đăng nhập.
 * Bấm icon tài khoản để đăng nhập vào trang quản lý; dùng chung dữ liệu mẫu với trang quản lý trong cùng tab.
 */
export function ShopLayout() {
  const demo = useShopDemo()
  const settingsQuery = useSettings(demo)
  const settings = demo ? settingsQuery.data : liveContact
  const { demoGuest, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Có trang trước trong app thì quay lại; mở thẳng bằng link hoặc vừa đặt đơn xong thì về trang chủ cửa hàng.
  const placed = (location.state as { placed?: boolean } | null)?.placed
  const goBack = () => (location.key !== 'default' && !placed ? navigate(-1) : navigate('/shop'))
  const cart = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  const count = cart.reduce((sum, line) => sum + line.quantity, 0)
  const tel = settings?.phone?.replace(/\s/g, '')
  const hours = settings?.openingHours?.trim()

  return (
    <div className="af-shop">
      {/* Thanh hotline cuộn đi theo trang, chỉ header bên dưới dính lại. */}
      <div className="af-shop-topbar">
        <div className="af-shop-topbar-inner">
          {tel && <a href={`tel:${tel}`}><Phone size={14} aria-hidden /> Hotline đặt nước: <strong>{settings?.phone}</strong></a>}
          {hours && <span className="af-shop-topbar-hours"><Clock3 size={14} aria-hidden /> Mở cửa {hours}</span>}
          <span className="af-shop-topbar-account"><AccountMenu variant="text" /></span>
        </div>
      </div>
      <header className="af-shop-header">
        <div className="af-shop-header-inner">
          <Link to="/shop" className="af-shop-brand">
            <span className="af-brand-mark">
              <Waves size={20} strokeWidth={2.2} />
            </span>
            <strong>AquaFlow</strong>
          </Link>
          <div className="af-shop-icons">
            <Button type="text" shape="circle" icon={<Search size={20} />} aria-label="Tìm sản phẩm" title="Tìm sản phẩm" onClick={() => navigate('/shop', { state: { focusSearch: Date.now() } })} />
            {/* Tra cứu đơn chỉ có ở bản dùng thử; tài khoản thật chờ API tra đơn công khai. */}
            {demo && <Button type="text" shape="circle" icon={<PackageSearch size={20} />} aria-label="Tra cứu đơn" title="Tra cứu đơn" onClick={() => navigate('/track')} />}
            <AccountMenu />
          </div>
          <Badge count={count} size="small" offset={[-4, 4]}>
            <Button type="primary" icon={<ShoppingCart size={17} />} onClick={() => setCartOpen(true)} aria-label={`Giỏ hàng, ${count} sản phẩm`}>
              <span className="af-shop-cart-label">Giỏ hàng</span>
            </Button>
          </Badge>
        </div>
      </header>
      <main className="af-shop-main">
        {demo && <Alert type="warning" showIcon title={demoGuest ? 'Đang xem như khách — dữ liệu mẫu, không gửi đơn tới cửa hàng' : 'Bản dùng thử — dữ liệu mẫu, không gửi đơn tới cửa hàng'} action={demoGuest ? <Button size="small" onClick={logout}>Thoát</Button> : undefined} style={{ marginBottom: 16 }} />}
        {location.pathname !== '/shop' && (
          <Button type="link" className="af-shop-back" icon={<ArrowLeft size={16} />} onClick={goBack}>Quay lại</Button>
        )}
        <Outlet context={{ openCart: () => setCartOpen(true) }} />
      </main>
      <ShopFooter demo={demo} contact={settings} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  )
}
