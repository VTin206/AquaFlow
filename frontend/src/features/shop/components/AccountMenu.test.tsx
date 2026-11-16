// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AccountMenu } from './AccountMenu'

const auth = vi.hoisted(() => ({
  isAuthenticated: true,
  user: { name: 'Khách Test', role: 'CUSTOMER', email: 'k@example.com' } as { name: string; role: string; email?: string },
  login: vi.fn(),
  logout: vi.fn(),
}))
vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => auth }))
vi.mock('@/features/auth/useStaff', () => ({ useStaff: () => undefined }))
vi.mock('@/features/auth/devAccounts', () => ({ devAccounts: [] }))

const renderMenu = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App>
        <MemoryRouter initialEntries={['/shop']}>
          <Routes>
            <Route path="/shop" element={<AccountMenu />} />
            <Route path="/shop/account" element={<p>Trang tài khoản</p>} />
            <Route path="/shop/orders" element={<p>Trang đơn hàng</p>} />
          </Routes>
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  )

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
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  auth.user = { name: 'Khách Test', role: 'CUSTOMER', email: 'k@example.com' }
})
afterEach(cleanup)

test('khách mở được trang tài khoản và danh sách đơn từ menu tài khoản', async () => {
  const first = renderMenu()
  fireEvent.click(screen.getByRole('button', { name: 'Tài khoản' }))
  fireEvent.click(await screen.findByRole('button', { name: /Tài khoản của tôi/ }))
  expect(await screen.findByText('Trang tài khoản')).toBeTruthy()
  first.unmount()

  renderMenu()
  fireEvent.click(screen.getByRole('button', { name: 'Tài khoản' }))
  fireEvent.click(await screen.findByRole('button', { name: /Đơn hàng của tôi/ }))
  expect(await screen.findByText('Trang đơn hàng')).toBeTruthy()
})

test('nhân viên không có nút tài khoản của khách', async () => {
  auth.user = { name: 'Nhân viên', role: 'ADMIN', email: 'a@example.com' }
  renderMenu()
  fireEvent.click(screen.getByRole('button', { name: 'Tài khoản' }))
  expect(await screen.findByRole('button', { name: /Trang quản lý/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Tài khoản của tôi/ })).toBeNull()
})
