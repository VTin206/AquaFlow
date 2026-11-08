// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CartDrawer } from './CartDrawer'

vi.mock('../cart', () => ({
  useCart: () => [
    { productId: 'P-1', quantity: 2 },
    { productId: 'P-OLD', quantity: 1 },
  ],
  useCartActions: () => ({ set: vi.fn(), remove: vi.fn(), clear: vi.fn() }),
}))
vi.mock('../shopService', () => ({
  useShopProducts: () => ({ data: [{ id: 'P-1', name: 'Nước 19L', price: 50000, unit: 'Bình', available: true }], isPending: false, isError: false }),
}))

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(cleanup)

test('bấm tên sản phẩm trong giỏ mở trang chi tiết và đóng giỏ; sản phẩm đã bỏ khỏi danh mục không có liên kết', () => {
  const onClose = vi.fn()
  render(
    <MemoryRouter initialEntries={['/shop']}>
      <Routes>
        <Route path="/shop" element={<CartDrawer open onClose={onClose} />} />
        <Route path="/shop/products/:id" element={<p>Trang chi tiết</p>} />
      </Routes>
    </MemoryRouter>,
  )
  const link = screen.getByRole('link', { name: 'Nước 19L' })
  expect(link.getAttribute('href')).toBe('/shop/products/P-1')
  expect(screen.queryByRole('link', { name: /Sản phẩm P-OLD/ })).toBeNull()
  fireEvent.click(link)
  expect(onClose).toHaveBeenCalled()
  expect(screen.getByText('Trang chi tiết')).toBeTruthy()
})
