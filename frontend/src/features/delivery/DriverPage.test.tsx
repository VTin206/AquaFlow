// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DriverPage } from './DriverPage'
import type { DeliveryStop, DeliveryTrip, TripCollections } from './deliveryApi'

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => ({ user: { email: 'driver@test', role: 'DELIVERY_STAFF' } }) }))
vi.mock('@/features/auth/useStaff', () => ({ useStaff: () => ({ name: 'Tài xế A', role: 'DELIVERY_STAFF', isDemo: false }) }))

const stop = (id: number, extra: Partial<DeliveryStop> = {}): DeliveryStop => ({
  id,
  orderId: id,
  orderCode: `AF-${id}`,
  orderStatus: 'OUT_FOR_DELIVERY',
  recipientName: `Khách ${id}`,
  recipientPhone: '0900000001',
  deliveryAddress: `${id} Lê Lợi, TP. Hồ Chí Minh`,
  latestAttempt: null,
  items: [{ productId: 1, productName: 'Nước 19 lít', unit: 'Bình', lotCode: 'L1', quantity: 2 }],
  ...extra,
})
const trip: DeliveryTrip = {
  id: 7,
  driverId: 3,
  driverName: 'Tài xế A',
  vehicle: null,
  status: 'IN_PROGRESS',
  createdAt: '2026-11-06T01:00:00Z',
  startedAt: '2026-11-06T02:00:00Z',
  endedAt: null,
  createdBy: 1,
  orders: [stop(1), stop(2)],
  settlement: null,
}
const collections: TripCollections = {
  receipts: [],
  balances: [
    { orderId: 1, total: 100000, paid: 0, due: 100000, bottlesToExchange: 2 },
    { orderId: 2, total: 50000, paid: 50000, due: 0, bottlesToExchange: 0 },
  ],
  cashExpected: 0,
  bottlesExpected: 0,
}

vi.mock('./deliveryApi', async (original) => ({
  ...(await original<typeof import('./deliveryApi')>()),
  deliveryApi: { list: vi.fn(async () => [trip]), drivers: vi.fn(async () => []), assignmentAttempts: vi.fn(async () => []) },
  collectionApi: { get: vi.fn(async () => collections), collect: vi.fn() },
}))

let client: QueryClient
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi
      .fn()
      .mockImplementation(() => ({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
  })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  cleanup()
  client.clear()
  vi.unstubAllGlobals()
})

it('chỉ hiện chuyến của tài xế, không có ô chọn tài xế, mỗi điểm có nút gọi, chỉ đường, thu tiền và kết quả', async () => {
  render(
    <QueryClientProvider client={client}>
      <App>
        <DriverPage />
      </App>
    </QueryClientProvider>,
  )
  const first = (await screen.findByText('Khách 1')).closest('li')!
  expect(screen.queryByText('Tài xế', { selector: 'span' })).toBeNull()
  expect(screen.queryByText(/Đang xem thay tài xế/)).toBeNull()
  expect(screen.getByText(/Tài xế A ·/)).toBeTruthy()

  const actions = within(first)
  expect(actions.getByRole('link', { name: /Gọi/ }).getAttribute('href')).toBe('tel:0900000001')
  expect(actions.getByRole('link', { name: /Chỉ đường/ }).getAttribute('href')).toContain('google.com/maps')
  expect(actions.getByRole('button', { name: /Kết quả giao|Ghi kết quả giao/ })).toBeTruthy()
  // Cả chuyến đang giao: không lặp thẻ "Đang giao" ở từng điểm.
  expect(actions.queryByText('Đang giao')).toBeNull()

  // Điểm đã thu đủ ghi rõ và khóa nút thu tiền.
  const second = (await screen.findByText('Khách 2')).closest('li')!
  expect(within(second).getByText('Đã thu đủ')).toBeTruthy()
  expect((within(second).getByRole('button', { name: /Thu tiền/ }) as HTMLButtonElement).disabled).toBe(true)

  expect(screen.getByRole('link', { name: /Xem lộ trình các điểm còn lại/ }).getAttribute('href')).toContain('/maps/dir/')
})
