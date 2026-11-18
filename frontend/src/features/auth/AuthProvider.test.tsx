// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { App } from 'antd'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act } from '@testing-library/react'
import { AxiosError } from 'axios'
import { readProfile, saveProfile, shopCart } from '@/features/shop/cartStore'
import { getStoredAuthToken, httpClient } from '@/shared/api/client'
import { AuthProvider } from './AuthProvider'
import { authService } from './authService'
import { useAuth } from './useAuth'

vi.mock('./authService', () => ({
  authService: { me: vi.fn(() => new Promise(() => undefined)), login: vi.fn(), logout: vi.fn(() => Promise.resolve()) },
}))

/** Máy chủ giả cho /auth/refresh: `ok` trả phiên mới kèm người dùng, ngược lại 401 (cookie hết hạn/bị thu hồi). */
const refreshReplies = (ok: boolean) => {
  const seen: string[] = []
  httpClient.defaults.adapter = async (config) => {
    seen.push(config.url ?? '')
    const response = {
      data: ok ? { accessToken: 'fresh', tokenType: 'Bearer', expiresIn: 900, user: { fullName: 'Khách A', email: 'a@x.vn', phone: '0900000001', role: 'CUSTOMER' } } : {},
      status: ok ? 200 : 401,
      statusText: '',
      headers: {},
      config,
    }
    if (!ok) throw new AxiosError('failed', '401', config, undefined, response)
    return response
  }
  return seen
}

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
  shopCart.actions.add('1', 2)
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
  // Mặc định không có máy chủ: yêu cầu làm mới thất bại ngay (lỗi mạng) thay vì treo sang test sau.
  httpClient.defaults.adapter = async (config) => {
    throw new AxiosError('offline', 'ERR_NETWORK', config)
  }
  vi.mocked(authService.logout).mockClear()
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  shopCart.actions.clear()
})

test('đăng xuất không để lại thông tin giao hàng và giỏ của khách trên máy', () => {
  signedInAs(Date.now() + 3_600_000)
  renderProvider()
  fireEvent.click(screen.getByRole('button', { name: 'Khách A' }))
  expect(screen.getByRole('button', { name: 'Chưa đăng nhập' })).toBeTruthy()
  expect(readProfile()).toBeNull()
  expect(shopCart.getSnapshot()).toEqual([])
  expect(JSON.stringify({ ...localStorage })).not.toContain('Khách A')
})

test('mở lại khi phiên đã hết hạn thì người sau không thấy thông tin của khách trước, giỏ vẫn giữ', () => {
  signedInAs(Date.now() - 1_000)
  renderProvider()
  expect(screen.getByRole('button', { name: 'Chưa đăng nhập' })).toBeTruthy()
  expect(readProfile()).toBeNull()
  expect(JSON.stringify({ ...localStorage })).not.toContain('Khách A')
  expect(shopCart.getSnapshot()).toEqual([{ productId: '1', quantity: 2 }])
})

test('mở lại khi access token hết hạn nhưng cookie refresh còn hạn thì khôi phục phiên với người dùng mới nhất', async () => {
  signedInAs(Date.now() - 1_000)
  localStorage.setItem('aquaflow.auth.token', 'expired')
  const seen = refreshReplies(true)
  renderProvider()
  // Trong lúc chờ không hiện thông tin người trước.
  expect(screen.getByRole('button', { name: 'Chưa đăng nhập' })).toBeTruthy()
  expect(await screen.findByRole('button', { name: 'Khách A' })).toBeTruthy()
  expect(seen).toEqual(['/auth/refresh'])
  expect(getStoredAuthToken()).toBe('fresh')
  expect(Number(localStorage.getItem('aquaflow.auth.expires-at'))).toBeGreaterThan(Date.now() + 800_000)
})

test('đăng xuất thu hồi refresh token trên máy chủ', () => {
  signedInAs(Date.now() + 3_600_000)
  localStorage.setItem('aquaflow.auth.token', 'current')
  renderProvider()
  fireEvent.click(screen.getByRole('button', { name: 'Khách A' }))
  expect(authService.logout).toHaveBeenCalledTimes(1)
  expect(getStoredAuthToken()).toBeNull()
})

test('làm mới trước khi access token hết hạn; không làm mới được thì kết thúc phiên', async () => {
  vi.useFakeTimers()
  try {
    signedInAs(Date.now() + 120_000)
    localStorage.setItem('aquaflow.auth.token', 'current')
    const seen = refreshReplies(false)
    renderProvider()
    expect(screen.getByRole('button', { name: 'Khách A' })).toBeTruthy()
    // Còn hơn 1 phút thì chưa làm mới.
    await act(() => vi.advanceTimersByTimeAsync(59_000))
    expect(seen).toEqual([])
    // Tới mốc 1 phút trước hạn: làm mới, bị từ chối (cả lần thử lại) thì đăng xuất.
    await act(() => vi.advanceTimersByTimeAsync(5_000))
    expect(seen).toEqual(['/auth/refresh', '/auth/refresh'])
    expect(screen.getByRole('button', { name: 'Chưa đăng nhập' })).toBeTruthy()
  } finally {
    vi.useRealTimers()
  }
})
