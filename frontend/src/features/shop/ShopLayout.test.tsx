// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ShopLayout } from './ShopLayout'

vi.mock('./cart', () => ({ useCart: () => [] }))
vi.mock('./shopService', () => ({
  shopKeys: { products: ['shop', 'products'] },
  useShopContact: () => undefined,
  useShopProducts: () => ({
    data: [
      {
        id: '1',
        name: 'LaVie 19L',
        brand: 'LaVie',
        price: 1,
        unit: 'Bình',
        available: null,
        catalog: { packaging: 'Bình có vòi', category: 'Nước khoáng', volumeMl: 19000 },
      },
    ],
  }),
}))
const auth = vi.hoisted(() => ({ user: null as { name: string; role: string } | null }))
vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => auth }))
vi.mock('./components/AccountMenu', () => ({ AccountMenu: () => null }))
vi.mock('./components/CartDrawer', () => ({ CartDrawer: () => null }))
vi.mock('./components/ShopFooter', () => ({ ShopFooter: () => null }))
vi.mock('@/app/useHomeLink', () => ({ useHomeLink: () => () => undefined }))

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})
afterEach(cleanup)

const renderShop = () =>
  render(
    <MemoryRouter initialEntries={['/shop']}>
      <Routes>
        <Route path="/shop" element={<ShopLayout />}>
          <Route index element={<p>Trang chủ cửa hàng</p>} />
          <Route path="drinks" element={<input aria-label="Tìm nước" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

const drinksLink = () => screen.getByRole('link', { name: 'Sản phẩm' })
const menuBox = () => drinksLink().parentElement!
const closed = () => menuBox().classList.contains('is-closed')

test('bấm "Sản phẩm" đóng menu; menu không tự mở lại khi focus chuyển đi hoặc menu ẩn dưới con trỏ', () => {
  renderShop()
  fireEvent.mouseEnter(menuBox())
  act(() => drinksLink().focus())
  fireEvent.click(drinksLink())
  expect(closed()).toBe(true)

  // Trang Sản phẩm lấy focus và menu vừa ẩn khiến con trỏ "rời" vùng menu: vẫn phải đóng.
  act(() => screen.getByLabelText('Tìm nước').focus())
  fireEvent.mouseLeave(menuBox())
  expect(closed()).toBe(true)

  // Rê chuột vào lại thì mở như bình thường.
  fireEvent.mouseEnter(menuBox())
  expect(closed()).toBe(false)
})

test('bấm một mục trong menu cũng đóng; focus bàn phím từ ngoài đi vào thì mở lại', () => {
  renderShop()
  fireEvent.mouseEnter(menuBox())
  fireEvent.click(screen.getByRole('menuitem', { name: 'LaVie' }))
  expect(closed()).toBe(true)
  fireEvent.mouseLeave(menuBox())
  expect(closed()).toBe(true)

  act(() => screen.getByRole('link', { name: 'Trang chủ' }).focus())
  act(() => drinksLink().focus())
  expect(closed()).toBe(false)
})

test('menu luôn ghi Tra cứu đơn; khách đã đăng nhập thì vào danh sách đơn của mình', () => {
  renderShop()
  expect(screen.getByRole('link', { name: 'Tra cứu đơn' }).getAttribute('href')).toBe('/track')
  cleanup()
  auth.user = { name: 'Khách Test', role: 'CUSTOMER' }
  renderShop()
  expect(screen.getByRole('link', { name: 'Tra cứu đơn' }).getAttribute('href')).toBe('/shop/orders')
  auth.user = null
})

test('mục Liên hệ cuộn xuống cột Liên hệ ở chân trang, không đổi trang', () => {
  const scroll = vi.fn()
  Element.prototype.scrollIntoView = scroll
  const contact = document.body.appendChild(document.createElement('section'))
  contact.id = 'lien-he'
  renderShop()
  fireEvent.click(screen.getByRole('link', { name: 'Liên hệ' }))
  expect(scroll).toHaveBeenCalledTimes(1)
  expect(scroll.mock.contexts[0]).toBe(contact)
  expect(screen.getByText('Trang chủ cửa hàng')).toBeTruthy()
  contact.remove()
})
