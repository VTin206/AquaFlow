// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { AvailableOrder } from '@/features/delivery/deliveryApi'
import type { Order } from '../types'
import { OrderBulkActions } from './OrderBulkActions'

const available = vi.hoisted(() => ({ data: [] as AvailableOrder[] }))
vi.mock('@/features/delivery/useLiveTrips', () => ({
  useAvailableOrders: (enabled: boolean) => ({ data: enabled ? available.data : undefined, isPending: false, isError: false, error: null }),
}))
vi.mock('@/features/delivery/components/CreateTripModal', () => ({
  CreateTripModal: ({ orders }: { orders: { code: string }[] }) => (
    <div role="dialog">Tạo chuyến: {orders.map((order) => order.code).join(', ')}</div>
  ),
}))
vi.mock('@/features/delivery/useTripCreatedNotice', () => ({ useTripCreatedNotice: () => () => undefined }))
const steps = vi.hoisted(() => ({ confirm: vi.fn(), prepare: vi.fn(), refresh: vi.fn() }))
vi.mock('../orderData', () => ({ useOrderStepRequests: () => steps }))
vi.mock('@/features/settings/settingsService', () => ({ useSettings: () => ({ data: {} }) }))
vi.mock('@/features/live/bottleDeposits', () => ({ useOrderDepositLabel: () => () => undefined }))
vi.mock('@/shared/print/usePrinter', () => ({ usePrinter: () => ({ print: vi.fn(), portal: null }) }))

const order = (id: string, status: Order['status'], method: Order['method'] = 'Giao tận nơi') =>
  ({
    id,
    code: `AF-${id}`,
    status,
    method,
    customer: 'Khách',
    phone: '',
    address: 'Q1',
    total: 0,
    lines: [],
    payments: [],
    history: [],
    time: '',
  }) as unknown as Order

afterEach(() => {
  cleanup()
  available.data = []
})
const mount = (orders: Order[]) =>
  render(
    <MemoryRouter>
      <App>
        <OrderBulkActions orders={orders} onSelect={vi.fn()} />
      </App>
    </MemoryRouter>,
  )

test('đơn chờ xác nhận chỉ hiện nút Xác nhận', () => {
  mount([order('1', 'Chờ xác nhận')])
  expect(screen.getByRole('button', { name: /Xác nhận/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Xếp chuyến|Chuẩn bị hàng/ })).toBeNull()
})

test('đơn đã xác nhận hiện Chuẩn bị hàng và chỉ chuyển các đơn đã xác nhận', async () => {
  steps.prepare.mockClear()
  steps.prepare.mockResolvedValue(undefined)
  const onSelect = vi.fn()
  render(
    <MemoryRouter>
      <App>
        <OrderBulkActions orders={[order('6', 'Đã xác nhận'), order('7', 'Đã xác nhận'), order('8', 'Chờ xác nhận')]} onSelect={onSelect} />
      </App>
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: /Chuẩn bị hàng \(2\)/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Chuẩn bị' }))
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith([]))
  expect(steps.prepare.mock.calls.map(([item]) => item.id)).toEqual(['6', '7'])
  expect(steps.confirm).not.toHaveBeenCalled()
})

test('đơn giao tận nơi đang chuẩn bị hiện Xếp chuyến và mở tạo chuyến với đơn BE còn cho xếp', () => {
  available.data = [
    { id: 2, orderCode: 'AF-2', recipientName: null, deliveryAddress: 'Q1', deliveryFailed: false, redeliveryEligible: false },
  ]
  mount([order('2', 'Đang chuẩn bị'), order('3', 'Đang chuẩn bị')])
  expect(screen.queryByRole('button', { name: /Xác nhận/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Xếp chuyến/ }))
  expect(screen.getByRole('dialog').textContent).toBe('Tạo chuyến: AF-2')
})

test('chọn lẫn trạng thái thì mỗi nút ghi số đơn áp dụng; bước không làm hàng loạt được thì không có nút chính', () => {
  mount([order('1', 'Chờ xác nhận'), order('2', 'Đang chuẩn bị'), order('4', 'Đang giao'), order('5', 'Đang chuẩn bị', 'Tại quầy')])
  expect(screen.getByRole('button', { name: /Xác nhận \(1\)/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Xếp chuyến \(1\)/ })).toBeTruthy()
  cleanup()
  mount([order('4', 'Đang giao')])
  expect(screen.queryByRole('button', { name: /Xác nhận|Xếp chuyến/ })).toBeNull()
})
