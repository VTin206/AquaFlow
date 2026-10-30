import { useState } from 'react'
import { Alert, Badge, Button } from 'antd'
import { LayoutDashboard, LogIn, PackageSearch, Phone, Search, ShoppingCart, Truck, UserRound, Waves } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { useSettings } from '../settings/settingsService'
import { useCart } from './cart'
import { CartDrawer } from './components/CartDrawer'
import { useShopDemo } from './shopService'

/**
 * Khung trang công khai cho khách, cũng là trang chủ khi chưa đăng nhập.
 * Nhân viên bấm "Đăng nhập" ở thanh trên cùng để vào trang quản lý; dùng chung dữ liệu mẫu với trang quản lý trong cùng tab.
 */
export function ShopLayout() {
  const demo = useShopDemo()
  const settingsQuery = useSettings(demo)
  const settings = demo ? settingsQuery.data : undefined
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const account = isAuthenticated
    ? { to: '/', label: 'Trang quản lý', icon: <LayoutDashboard size={15} aria-hidden /> }
    : { to: '/login', label: 'Đăng nhập', icon: <LogIn size={15} aria-hidden /> }
  const cart = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  const count = cart.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <div className="af-shop">
      <header className="af-shop-header">
        <div className="af-shop-topbar">
          <div className="af-shop-topbar-inner">
            <span className="af-shop-topbar-note">
              <Truck size={15} aria-hidden /> Giao nước tận nơi · Đặt hàng không cần tài khoản
            </span>
            <nav className="af-shop-topbar-links" aria-label="Tài khoản">
              {demo && <NavLink to="/track"><PackageSearch size={15} aria-hidden /> Tra cứu đơn</NavLink>}
              {isAuthenticated && user?.name && <span className="af-shop-topbar-user">Xin chào, {user.name}</span>}
              <Link to={account.to}>{account.icon} {account.label}</Link>
            </nav>
          </div>
        </div>
        <div className="af-shop-header-inner">
          <Link to="/shop" className="af-shop-brand">
            <span className="af-brand-mark">
              <Waves size={20} strokeWidth={2.2} />
            </span>
            <strong>AquaFlow</strong>
          </Link>
          <nav className="af-shop-nav" aria-label="Điều hướng cửa hàng">
            <NavLink to="/shop" end>
              Sản phẩm
            </NavLink>
          </nav>
          <div className="af-shop-icons">
            <Button type="text" shape="circle" icon={<Search size={20} />} aria-label="Tìm sản phẩm" title="Tìm sản phẩm" onClick={() => navigate('/shop', { state: { focusSearch: Date.now() } })} />
            <Button type="text" shape="circle" icon={<UserRound size={20} />} aria-label={account.label} title={account.label} onClick={() => navigate(account.to)} />
          </div>
          <Badge count={count} size="small" offset={[-4, 4]}>
            <Button type="primary" icon={<ShoppingCart size={17} />} onClick={() => setCartOpen(true)} aria-label={`Giỏ hàng, ${count} sản phẩm`}>
              <span className="af-shop-cart-label">Giỏ hàng</span>
            </Button>
          </Badge>
        </div>
      </header>
      <main className="af-shop-main">
        {demo && <Alert type="warning" showIcon title="Bản dùng thử — dữ liệu mẫu, không gửi đơn tới cửa hàng" style={{ marginBottom: 16 }} />}
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
        <small>{demo ? 'Đơn dùng thử chỉ lưu trong tab hiện tại và mất khi tải lại trang.' : 'AquaFlow · Danh mục sản phẩm'}</small>
      </footer>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  )
}
