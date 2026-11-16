// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ShopLayout } from './ShopLayout'

vi.mock('./cart', () => ({ useCart: () => [] }))
vi.mock('./shopService', () => ({ shopKeys: { products: ['shop', 'products'] }, useShopContact: () => undefined }))
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

const drinksLink = () => screen.getByRole('link', { name: 'Nước uống' })
const menuBox = () => drinksLink().parentElement!
const closed = () => menuBox().classList.contains('is-closed')

test('bấm "Nước uống" đóng menu; menu không tự mở lại khi focus chuyển đi hoặc menu ẩn dưới con trỏ', () => {
  renderShop()
  fireEvent.mouseEnter(menuBox())
  act(() => drinksLink().focus())
  fireEvent.click(drinksLink())
  expect(closed()).toBe(true)

  // Trang Nước uống lấy focus và menu vừa ẩn khiến con trỏ "rời" vùng menu: vẫn phải đóng.
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
  fireEvent.click(screen.getByRole('menuitem', { name: 'Nước Lavie' }))
  expect(closed()).toBe(true)
  fireEvent.mouseLeave(menuBox())
  expect(closed()).toBe(true)

  act(() => screen.getByRole('link', { name: 'Trang chủ' }).focus())
  act(() => drinksLink().focus())
  expect(closed()).toBe(false)
})

test('menu dẫn khách đã đăng nhập tới đơn của mình, còn lại vào tra cứu đơn', () => {
  renderShop()
  expect(screen.getByRole('link', { name: 'Tra cứu đơn' }).getAttribute('href')).toBe('/track')
  cleanup()
  auth.user = { name: 'Khách Test', role: 'CUSTOMER' }
  renderShop()
  expect(screen.getByRole('link', { name: 'Đơn của tôi' }).getAttribute('href')).toBe('/shop/orders')
  expect(screen.queryByRole('link', { name: 'Tra cứu đơn' })).toBeNull()
  auth.user = null
})
