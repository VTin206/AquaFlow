import { useState } from 'react'
import { Badge, Button } from 'antd'
import { LayoutDashboard, PackageSearch, Phone, ShoppingCart, Waves } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { useSettings } from '../settings/settingsService'
import { useCart } from './cart'
import { CartDrawer } from './components/CartDrawer'

/** Khung trang công khai cho khách: không cần đăng nhập, dùng chung dữ liệu mẫu với trang quản lý trong cùng tab. */
export function ShopLayout() {
  const { data: settings } = useSettings()
  const { isAuthenticated } = useAuth()
  const cart = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  const count = cart.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <div className="af-shop">
      <header className="af-shop-header">
        <div className="af-shop-header-inner">
          <Link to="/shop" className="af-shop-brand">
            <span className="af-brand-mark">
              <Waves size={20} strokeWidth={2.2} />
            </span>
            <strong>{settings?.storeName ?? 'Cửa hàng nước'}</strong>
          </Link>
          <nav className="af-shop-nav" aria-label="Điều hướng cửa hàng">
            <NavLink to="/shop" end>
              Sản phẩm
            </NavLink>
            <NavLink to="/track" aria-label="Tra cứu đơn">
              <PackageSearch size={16} aria-hidden />
              <span className="af-shop-nav-text">Tra cứu đơn</span>
            </NavLink>
            {isAuthenticated && (
              <Link to="/" title="Về trang quản lý cửa hàng" aria-label="Về trang quản lý">
                <LayoutDashboard size={16} aria-hidden />
                <span className="af-shop-nav-text">Quản lý</span>
              </Link>
            )}
          </nav>
          <Badge count={count} size="small" offset={[-4, 4]}>
            <Button type="primary" icon={<ShoppingCart size={17} />} onClick={() => setCartOpen(true)} aria-label={`Giỏ hàng, ${count} sản phẩm`}>
              <span className="af-shop-cart-label">Giỏ hàng</span>
            </Button>
          </Badge>
        </div>
      </header>
      <main className="af-shop-main">
        <Outlet context={{ openCart: () => setCartOpen(true) }} />
      </main>
      <footer className="af-shop-footer">
        <strong>{settings?.storeName}</strong>
        <span>{settings?.address}</span>
        {settings?.phone && (
          <a href={`tel:${settings.phone.replace(/\s/g, '')}`}>
            <Phone size={14} aria-hidden /> {settings.phone}
          </a>
        )}
        <small>Bản demo: đơn đặt ở đây hiện ngay trong trang quản lý khi mở cùng một tab trình duyệt.</small>
      </footer>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  )
}
