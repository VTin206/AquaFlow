import { useState } from 'react'
import { Badge, Button, Dropdown } from 'antd'
import { ArrowLeft, ChevronDown, Clock3, PackageSearch, Phone, Search, ShoppingCart, Waves } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import { useCart } from './cart'
import { AccountMenu } from './components/AccountMenu'
import { CartDrawer } from './components/CartDrawer'
import { UkFlag, VietnamFlag } from './components/Flags'
import { ShopFooter } from './components/ShopFooter'
import { shopKeys, useShopContact, useShopDemo, useShopFeature } from './shopService'
import { useHomeLink, type FreshState } from '@/app/useHomeLink'
import './shop.css'

type DrinkMenuFilter = { brand?: string; group?: string; category?: string }
type DrinkMenuItem = { label: string; filter: DrinkMenuFilter }

const drinkMenuColumns: { title: string; items: DrinkMenuItem[] }[] = [
  {
    title: 'THƯƠNG HIỆU',
    items: [
      { label: 'Nước Vĩnh Hảo', filter: { brand: 'Vĩnh Hảo' } },
      { label: 'Nước Lavie', filter: { brand: 'LaVie' } },
      { label: 'Nước Bidrico', filter: { brand: 'Bidrico' } },
      { label: 'Nước Ion Life', filter: { brand: 'ion Life' } },
      { label: 'Nước Aquafina', filter: { brand: 'Aquafina' } },
      { label: 'Nước Satori', filter: { brand: 'Satori' } },
      { label: 'Nước Viva', filter: { brand: 'LaVie' } },
      { label: 'M-Water', filter: { brand: 'M-Water' } },
      { label: 'AQUA Water', filter: { brand: 'AQUA Water' } },
    ],
  },
  {
    title: 'NƯỚC UỐNG ĐÓNG BÌNH',
    items: [
      { label: 'Bình nước 19L – 20L vòi bấm', filter: { group: 'jug-tap' } },
      { label: 'Bình nước 19L – 20L úp máy', filter: { group: 'jug-dispenser' } },
      { label: 'Bình nước 4,5L – 5L', filter: { group: 'can-5l' } },
      { label: 'Nước uống bổ sung khoáng', filter: { category: 'Bù khoáng & điện giải' } },
    ],
  },
  {
    title: 'NƯỚC SUỐI ĐÓNG CHAI',
    items: [
      { label: 'Chai nhỏ 250ml – 350ml', filter: { group: 'small-350' } },
      { label: 'Thùng chai suối 350ml', filter: { group: 'small-350' } },
      { label: 'Thùng chai suối 500ml', filter: { group: 'small-500' } },
      { label: 'Thùng chai suối Aquafina', filter: { brand: 'Aquafina' } },
      { label: 'Thùng chai suối Lavie', filter: { brand: 'LaVie' } },
      { label: 'Thùng chai suối Viva', filter: { brand: 'LaVie' } },
    ],
  },
]

const drinkMenuHref = (filter: DrinkMenuFilter) => {
  const params = new URLSearchParams(filter)
  return `/shop?${params.toString()}#products`
}

/**
 * Khung trang công khai cho khách, cũng là trang chủ khi chưa đăng nhập.
 * Bấm icon tài khoản để đăng nhập vào trang quản lý; dùng chung dữ liệu mẫu với trang quản lý trong cùng tab.
 */
export function ShopLayout() {
  // Chỉ dùng cho nhãn báo đang xem dữ liệu mẫu.
  const demo = useShopDemo()
  const showTracking = useShopFeature('orderTracking')
  const settings = useShopContact()
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
  const count = cart.reduce((sum, line) => sum + line.quantity, 0)
  const tel = settings?.phone?.replace(/\s/g, '')
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
          <Link to="/shop" className="af-shop-brand" onClick={goHome}>
            <span className="af-brand-mark">
              <Waves size={22} strokeWidth={2.2} />
            </span>
            <strong>AquaFlow</strong>
          </Link>
          <nav className="af-shop-nav" aria-label="Điều hướng cửa hàng">
            <NavLink to="/shop" end className={({ isActive }) => `af-shop-nav-link${isActive ? ' is-active' : ''}`}>
              Trang chủ
            </NavLink>
            <div className="af-shop-nav-menu">
              <Link to="/shop#products" className="af-shop-nav-link" aria-haspopup="true">
                Nước uống
              </Link>
              <div className="af-shop-mega" role="menu" aria-label="Danh mục nước uống">
                {drinkMenuColumns.map((column) => (
                  <section key={column.title} className="af-shop-mega-column">
                    <strong>{column.title}</strong>
                    <ul>
                      {column.items.map((item) => (
                        <li key={item.label}>
                          <Link to={drinkMenuHref(item.filter)} role="menuitem">
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
            {showTracking && (
              <NavLink to="/track" className={({ isActive }) => `af-shop-nav-link${isActive ? ' is-active' : ''}`}>
                Tra cứu đơn
              </NavLink>
            )}
            <Link to="/shop/account" className="af-shop-nav-link">
              Tài khoản
            </Link>
          </nav>
          <div className="af-shop-icons">
            <Button
              type="text"
              shape="circle"
              icon={<Search size={24} />}
              aria-label="Tìm sản phẩm"
              title="Tìm sản phẩm"
              onClick={() => navigate('/shop', { state: { focusSearch: Date.now() } })}
            />
            {showTracking && (
              <Button
                type="text"
                shape="circle"
                icon={<PackageSearch size={24} />}
                aria-label="Tra cứu đơn"
                title="Tra cứu đơn"
                onClick={() => navigate('/track')}
              />
            )}
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
        <ErrorBoundary key={location.pathname} homeHref="/shop"><Outlet key={fresh ?? 'page'} context={{ openCart: () => setCartOpen(true) }} /></ErrorBoundary>
      </main>
      <ShopFooter demo={demo} contact={settings} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  )
}
