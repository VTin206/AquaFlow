// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { App } from 'antd'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { carts, readProfile, saveProfile } from '@/features/shop/cartStore'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

vi.mock('./authService', () => ({ authService: { me: vi.fn(() => new Promise(() => undefined)), login: vi.fn() } }))

function Probe() {
  const { user, logout } = useAuth()
  return <button onClick={logout}>{user?.name ?? 'Chưa đăng nhập'}</button>
}
const renderProvider = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </App>
    </QueryClientProvider>,
  )
const signedInAs = (expiresAt: number) => {
  localStorage.setItem('aquaflow.auth.user', JSON.stringify({ name: 'Khách A', role: 'Khách hàng', phone: '0900000001' }))
  localStorage.setItem('aquaflow.auth.expires-at', String(expiresAt))
  saveProfile({ customer: 'Khách A', phone: '0900000001', address: '99 Nhà A' })
  carts.live.actions.add('1', 2)
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  carts.live.actions.clear()
})

test('đăng xuất không để lại thông tin giao hàng và giỏ của khách trên máy', () => {
  signedInAs(Date.now() + 3_600_000)
  renderProvider()
  fireEvent.click(screen.getByRole('button', { name: 'Khách A' }))
  expect(screen.getByRole('button', { name: 'Chưa đăng nhập' })).toBeTruthy()
  expect(readProfile()).toBeNull()
  expect(carts.live.getSnapshot()).toEqual([])
  expect(JSON.stringify({ ...localStorage })).not.toContain('Khách A')
})

test('mở lại khi phiên đã hết hạn thì người sau không thấy thông tin của khách trước, giỏ vẫn giữ', () => {
  signedInAs(Date.now() - 1_000)
  renderProvider()
  expect(screen.getByRole('button', { name: 'Chưa đăng nhập' })).toBeTruthy()
  expect(readProfile()).toBeNull()
  expect(JSON.stringify({ ...localStorage })).not.toContain('Khách A')
  expect(carts.live.getSnapshot()).toEqual([{ productId: '1', quantity: 2 }])
})
