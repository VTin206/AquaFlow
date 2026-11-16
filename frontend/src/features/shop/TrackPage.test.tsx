// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TrackPage } from './TrackPage'

vi.mock('@/features/settings/settingsService', () => ({ useSettings: () => ({ data: undefined }) }))
const auth = vi.hoisted(() => ({ user: null as { name: string; role: string } | null }))
vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => auth }))
vi.mock('./shopService', () => ({
  useLookupOrder: () => vi.fn(),
  useTrackedOrder: vi.fn(),
  useShopContact: () => ({ phone: '0283 456 7890' }),
}))

const renderPage = () =>
  render(
    <App>
      <MemoryRouter>
        <TrackPage />
      </MemoryRouter>
    </App>,
  )

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => {
  cleanup()
  auth.user = null
})

test('hiện form tra cứu dùng được và lối đăng nhập', () => {
  renderPage()
  expect((screen.getByLabelText('Mã đơn') as HTMLInputElement).disabled).toBe(false)
  expect(screen.getByRole('button', { name: /Tra cứu/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Đăng nhập/ })).toBeTruthy()
  expect(document.body.textContent).not.toMatch(/chưa hỗ trợ|backend|API/i)
})

test('đã đăng nhập thì dẫn tới đơn của tôi thay vì nút đăng nhập', () => {
  auth.user = { name: 'Khách Test', role: 'CUSTOMER' }
  renderPage()
  expect(screen.getByRole('link', { name: /Đơn hàng của tôi/ }).getAttribute('href')).toBe('/shop/orders')
  expect(screen.queryByRole('button', { name: /Đăng nhập/ })).toBeNull()
})
