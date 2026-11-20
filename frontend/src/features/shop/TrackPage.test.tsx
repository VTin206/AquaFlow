// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { PublicOrder } from '@/features/orders/types'
import { TrackPage } from './TrackPage'
import { useTrackedOrder } from './shopService'

vi.mock('@/features/settings/settingsService', () => ({
  useSettings: () => ({ data: undefined }),
}))

const auth = vi.hoisted(() => ({
  user: null as { name: string; role: string } | null,
}))

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => auth,
}))

vi.mock('./shopService', () => ({
  useLookupOrder: () => vi.fn(),
  useTrackedOrder: vi.fn(),
  useShopContact: () => ({ phone: '0283 456 7890' }),
  useTransferAccount: () => undefined,
}))

const renderPage = () =>
  render(
    <App>
      <MemoryRouter>
        <TrackPage />
      </MemoryRouter>
    </App>,
  )

const renderPlacedOrder = (status: PublicOrder['status']) => {
  const order: PublicOrder = {
    id: 'AF-TEST01',
    customer: 'Khách Test',
    address: 'TP. Hồ Chí Minh',
    status,
    method: 'Giao tận nơi',
    lines: [],
    total: 100000,
    paid: 0,
    due: 100000,
    deliveryFee: 0,
    trackingToken: 'test-token',
    createdAt: '2026-11-20T10:00:00Z',
  }

  vi.mocked(useTrackedOrder).mockReturnValue({
    data: order,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTrackedOrder>)

  return render(
    <App>
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/track/test-token',
            state: { placed: true },
          },
        ]}
      >
        <Routes>
          <Route path="/track/:token" element={<TrackPage />} />
        </Routes>
      </MemoryRouter>
    </App>,
  )
}

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
      observe() { }
      unobserve() { }
      disconnect() { }
    },
  )
})

afterEach(() => {
  cleanup()
  auth.user = null
  vi.mocked(useTrackedOrder).mockReset()
})

test('hiện form tra cứu dùng được và lối đăng nhập', () => {
  renderPage()

  expect(
    (screen.getByLabelText('Mã đơn') as HTMLInputElement).disabled,
  ).toBe(false)

  expect(
    screen.getByRole('button', { name: /Tra cứu/ }),
  ).toBeTruthy()

  expect(
    screen.getByRole('button', { name: /Đăng nhập/ }),
  ).toBeTruthy()

  expect(document.body.textContent).not.toMatch(
    /chưa hỗ trợ|backend|API/i,
  )
})

test('đã đăng nhập thì dẫn tới đơn của tôi thay vì nút đăng nhập', () => {
  auth.user = { name: 'Khách Test', role: 'CUSTOMER' }

  renderPage()

  expect(
    screen
      .getByRole('link', { name: /Đơn hàng của tôi/ })
      .getAttribute('href'),
  ).toBe('/shop/orders')

  expect(
    screen.queryByRole('button', { name: /Đăng nhập/ }),
  ).toBeNull()
})

test('đơn chờ xác nhận vẫn thông báo chờ cửa hàng xác nhận', () => {
  renderPlacedOrder('Chờ xác nhận')

  expect(
    screen.getByText(
      /Cửa hàng sẽ gọi xác nhận trong giờ làm việc/,
    ),
  ).toBeTruthy()
})

test('đơn tự động xác nhận hiển thị thông báo đã xác nhận', () => {
  renderPlacedOrder('Đã xác nhận')

  expect(
    screen.getByText(/Đơn hàng đã được xác nhận/),
  ).toBeTruthy()

  expect(
    screen.queryByText(
      /Cửa hàng sẽ gọi xác nhận trong giờ làm việc/,
    ),
  ).toBeNull()
})

test('đơn đang chuẩn bị không yêu cầu khách chờ xác nhận', () => {
  renderPlacedOrder('Đang chuẩn bị')

  expect(
    screen.getByText(
      'Lưu lại trang này hoặc mã đơn để theo dõi trạng thái đơn hàng.',
    ),
  ).toBeTruthy()

  expect(
    screen.queryByText(
      /Cửa hàng sẽ gọi xác nhận trong giờ làm việc/,
    ),
  ).toBeNull()
})
