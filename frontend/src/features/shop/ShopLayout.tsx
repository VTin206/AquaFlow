import { useState } from 'react'
import { Badge, Button, Dropdown } from 'antd'
import { ArrowLeft, ChevronDown, Clock3, MapPin, Phone, Search, ShoppingCart } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import { isCustomer } from '@/features/auth/accountAccess'
import { useAuth } from '@/features/auth/useAuth'
import { useCart } from './cart'
import { AccountMenu } from './components/AccountMenu'
import { CartDrawer } from './components/CartDrawer'
import { DeliveryAreaNotice } from './components/DeliveryAreaNotice'
import { UkFlag, VietnamFlag } from './components/Flags'
import { ShopEnter } from './components/ShopEnter'
import { ShopFooter } from './components/ShopFooter'
import { buildDrinkMenu, drinkMenuHref } from './drinkMenu'
import { shopKeys, useShopContact, useShopProducts } from './shopService'
import { useHomeLink, type FreshState } from '@/app/useHomeLink'
import { DELIVERY_AREA, DELIVERY_AREA_EXCLUDES } from '@/shared/address/hcmWards'
import './shop.css'

/**
 * Khung trang công khai cho khách, cũng là trang chủ khi chưa đăng nhập.
 * Bấm icon tài khoản để đăng nhập vào trang quản lý.
 */
export function ShopLayout() {
  const settings = useShopContact()
  const drinkMenuColumns = buildDrinkMenu(useShopProducts().data ?? [])
  // Mục menu luôn là "Tra cứu đơn"; khách đã đăng nhập thì vào thẳng danh sách đơn của mình thay cho form nhập mã đơn.
  const { user, isAuthenticated, restoring } = useAuth()
  const ownOrders = isCustomer(user)
  const navigate = useNavigate()
  const location = useLocation()
  const goHome = useHomeLink('/shop', shopKeys.products)
  // Bấm logo: dựng lại trang từ đầu để bộ lọc và trang về mặc định.
  const fresh = (location.state as FreshState | null)?.fresh
  // Có trang trước trong app thì quay lại; mở thẳng bằng link hoặc vừa đặt đơn xong thì về trang chủ cửa hàng.
  const placed = (location.state as { placed?: boolean } | null)?.placed
  const goBack = () => (location.key !== 'default' && !placed ? navigate(-1) : navigate('/shop'))
  const cart = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  const [megaClosed, setMegaClosed] = useState(false)
  const count = cart.reduce((sum, line) => sum + line.quantity, 0)
  const tel = settings?.phone?.replace(/\s/g, '')
  // Hỏi khu vực giao ở trang mua hàng cho khách chưa đăng nhập; tra cứu đơn, đăng nhập thì không chen vào.
  const askArea = !restoring && !isAuthenticated && /^\/(?:shop(?:\/drinks|\/products\/[^/]+)?|checkout)\/?$/.test(location.pathname)
  const hours = settings?.openingHours?.trim()

  return (
    <div className="af-shop">
      {/* Thanh hotline cuộn đi theo trang, chỉ header bên dưới dính lại. */}
      <div className="af-shop-topbar">
        <div className="af-shop-topbar-inner">
          {tel && (
            <a href={`tel:${tel}`}>
              <Phone size={14} aria-hidden /> <span className="af-shop-topbar-label">Hotline đặt nước:</span>{' '}
              <strong>{settings?.phone}</strong>
            </a>
          )}
          {hours && (
            <span className="af-shop-topbar-hours">
              <Clock3 size={14} aria-hidden /> Mở cửa {hours}
            </span>
          )}
          <span className="af-shop-topbar-area" title={`Chỉ giao trong ${DELIVERY_AREA}, chưa gồm ${DELIVERY_AREA_EXCLUDES}`}>
            <MapPin size={14} aria-hidden /> Chỉ giao trong {DELIVERY_AREA}
            <span className="af-shop-topbar-area-detail">(chưa gồm {DELIVERY_AREA_EXCLUDES})</span>
          </span>
          <span className="af-shop-topbar-account">
            <AccountMenu variant="text" />
          </span>
          {/* Chưa có bản dịch: chỉ Tiếng Việt, English để chỗ sẵn. */}
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              selectable: true,
              selectedKeys: ['vi'],
              items: [
                { key: 'vi', icon: <VietnamFlag />, label: 'Tiếng Việt' },
                { key: 'en', icon: <UkFlag />, label: 'English (sắp có)', disabled: true },
              ],
            }}
          >
            <Button type="link" className="af-shop-topbar-link af-shop-topbar-lang" aria-label="Ngôn ngữ: Tiếng Việt">
              <VietnamFlag /> VI <ChevronDown size={14} aria-hidden />
            </Button>
          </Dropdown>
        </div>
      </div>
      <header className="af-shop-header">
        <div className="af-shop-header-inner">
          <Link to="/shop" className="af-shop-brand" onClick={goHome} aria-label="AquaFlow - Trang chủ cửa hàng">
            <img className="af-brand-logo" src="/images/aquaflow-logo.png" alt="AquaFlow" />
          </Link>
          <nav className="af-shop-nav" aria-label="Điều hướng cửa hàng">
            <NavLink to="/shop" end className={({ isActive }) => `af-shop-nav-link${isActive ? ' is-active' : ''}`}>
              Trang chủ
            </NavLink>
            {/*
              Menu mở khi rê chuột/focus; bấm thì đóng. Chỉ mở lại khi chuột đi vào lại hoặc focus từ ngoài đi vào:
              không dựa vào lúc chuột rời/mất focus, vì menu ẩn dưới con trỏ hay chuyển trang cũng gây ra hai sự kiện đó.
            */}
            <div
              className={`af-shop-nav-menu${megaClosed ? ' is-closed' : ''}`}
              onMouseEnter={() => setMegaClosed(false)}
              onFocus={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setMegaClosed(false)
              }}
            >
              <NavLink
                to="/shop/drinks"
                className={({ isActive }) => `af-shop-nav-link${isActive ? ' is-active' : ''}`}
                aria-haspopup="true"
                onClick={() => setMegaClosed(true)}
              >
                Sản phẩm
              </NavLink>
              <div className="af-shop-mega" role="menu" aria-label="Danh mục sản phẩm">
                {drinkMenuColumns.map((column) => (
                  <section key={column.title} className="af-shop-mega-column">
                    <strong>{column.title}</strong>
                    <ul>
                      {column.items.map((item) => (
                        <li key={item.label}>
                          <Link to={drinkMenuHref(item.filter)} role="menuitem" onClick={() => setMegaClosed(true)}>
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
            <NavLink
              to={ownOrders ? '/shop/orders' : '/track'}
              className={({ isActive }) => `af-shop-nav-link${isActive ? ' is-active' : ''}`}
            >
              Tra cứu đơn
            </NavLink>
          </nav>
          <div className="af-shop-icons">
            <Button
              type="text"
              shape="circle"
              icon={<Search size={24} />}
              aria-label="Tìm sản phẩm"
              title="Tìm sản phẩm"
              onClick={() => navigate('/shop/drinks', { state: { focusSearch: Date.now() } })}
            />
            <AccountMenu />
          </div>
          <Badge count={count} size="small" offset={[-4, 4]}>
            <Button
              type="primary"
              size="large"
              icon={<ShoppingCart size={20} />}
              onClick={() => setCartOpen(true)}
              aria-label={`Giỏ hàng, ${count} sản phẩm`}
            >
              <span className="af-shop-cart-label">Giỏ hàng</span>
            </Button>
          </Badge>
        </div>
      </header>
      <main className="af-shop-main">
        {location.pathname !== '/shop' && (
          <Button type="link" className="af-shop-back" icon={<ArrowLeft size={16} />} onClick={goBack}>
            Quay lại
          </Button>
        )}
        <ErrorBoundary key={location.pathname} homeHref="/shop">
          {/* Từng thẻ hiện fade-in-up nối tiếp; chạy lại mỗi lần đổi trang. */}
          <ShopEnter key={fresh ?? 'page'}>
            <Outlet context={{ openCart: () => setCartOpen(true) }} />
          </ShopEnter>
        </ErrorBoundary>
      </main>
      <ShopFooter contact={settings} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      {askArea && <DeliveryAreaNotice phone={settings?.phone} />}
    </div>
  )
}
