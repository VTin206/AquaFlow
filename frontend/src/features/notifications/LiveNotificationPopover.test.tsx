// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LiveNotificationPopover } from './LiveNotificationPopover'
import { notificationService, type Notification } from './notificationService'

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => ({ user: { email: 'driver@test', role: 'DELIVERY_STAFF' } }) }))
vi.mock('@/features/orders/components/OrderDetails', () => ({ OrderDetails: () => null }))
vi.mock('./notificationService', () => ({
  notificationService: { list: vi.fn(), unreadCount: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() },
}))

const tripAlert: Notification = {
  id: 1,
  title: 'Có chuyến giao mới',
  message: 'Chuyến #7 có 2 đơn đang chờ bạn khởi hành.',
  createdAt: new Date().toISOString(),
  readAt: null,
  kind: 'TRIP_ASSIGNED',
  entityType: 'TRIP',
  entityId: 7,
  resolvedAt: null,
}

const show = (driver: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App>
        <MemoryRouter initialEntries={['/start']}>
          <Routes>
            <Route path="/start" element={<LiveNotificationPopover driver={driver} />} />
            <Route path="/driver" element={<p>Màn hình chuyến</p>} />
          </Routes>
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  )

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.mocked(notificationService.list).mockResolvedValue([tripAlert])
  vi.mocked(notificationService.unreadCount).mockResolvedValue({ count: 1 })
  vi.mocked(notificationService.markRead).mockResolvedValue(tripAlert)
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

it('shows a driver their trip alert and opens the trip screen', async () => {
  show(true)
  fireEvent.click(await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' }))
  expect(await screen.findByText('Chuyến #7 có 2 đơn đang chờ bạn khởi hành.')).toBeTruthy()
  // Tài xế không mở được trang đơn hàng nên không có liên kết này.
  expect(screen.queryByText(/Xem tất cả đơn hàng/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Xem chuyến/ }))
  expect(await screen.findByText('Màn hình chuyến')).toBeTruthy()
  await waitFor(() => expect(notificationService.markRead).toHaveBeenCalledWith(1))
})

it('keeps the orders link for office staff', async () => {
  show(false)
  fireEvent.click(await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' }))
  expect(await screen.findByText(/Xem tất cả đơn hàng/)).toBeTruthy()
})
