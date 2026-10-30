import { useState } from 'react'
import { Alert, Badge, Button } from 'antd'
import { PackageSearch, Search, ShoppingCart, Waves } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useSettings } from '../settings/settingsService'
import { useCart } from './cart'
import { AccountMenu } from './components/AccountMenu'
import { AuthModal, type AuthTab } from './components/AuthModal'
import { CartDrawer } from './components/CartDrawer'
import { ShopFooter } from './components/ShopFooter'
import { useShopDemo } from './shopService'

/**
 * Khung trang công khai cho khách, cũng là trang chủ khi chưa đăng nhập.
 * Bấm icon tài khoản để đăng nhập vào trang quản lý; dùng chung dữ liệu mẫu với trang quản lý trong cùng tab.
 */
export function ShopLayout() {
  const demo = useShopDemo()
  const settingsQuery = useSettings(demo)
  const settings = demo ? settingsQuery.data : undefined
  const navigate = useNavigate()
  const cart = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  const [authTab, setAuthTab] = useState<AuthTab | null>(null)
  const count = cart.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <div className="af-shop">
      <header className="af-shop-header">
        <div className="af-shop-header-inner">
          <Link to="/shop" className="af-shop-brand">
            <span className="af-brand-mark">
              <Waves size={20} strokeWidth={2.2} />
            </span>
            <strong>AquaFlow</strong>
          </Link>
          {demo && <nav className="af-shop-nav" aria-label="Điều hướng cửa hàng">
            <NavLink to="/track" aria-label="Tra cứu đơn">
              <PackageSearch size={16} aria-hidden />
              <span className="af-shop-nav-text">Tra cứu đơn</span>
            </NavLink>
          </nav>}
          <div className="af-shop-icons">
            <Button type="text" shape="circle" icon={<Search size={20} />} aria-label="Tìm sản phẩm" title="Tìm sản phẩm" onClick={() => navigate('/shop', { state: { focusSearch: Date.now() } })} />
            <AccountMenu onLogin={() => setAuthTab('login')} />
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
      <ShopFooter demo={demo} contact={settings} onAccount={setAuthTab} />
      <AuthModal tab={authTab} onTabChange={setAuthTab} onClose={() => setAuthTab(null)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  )
}
