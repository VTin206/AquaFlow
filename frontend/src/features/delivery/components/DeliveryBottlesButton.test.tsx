// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DeliveryBottlesModal } from './DeliveryBottlesButton'
import { deliveryBottleApi, type DeliveryBottles } from '../deliveryBottleApi'
vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => ({ user: { email: 'driver@test.local' } }) }))
const data: DeliveryBottles = {
  tracked: true,
  linkedCustomer: true,
  given: true,
  canReturn: true,
  lines: [
    { bottleTypeId: 1, name: 'Vỏ A', given: 2, returned: 0, unitDeposit: 40000 },
    { bottleTypeId: 2, name: 'Vỏ B', given: 1, returned: 0, unitDeposit: 60000 },
  ],
  receipts: [],
}
const clients: QueryClient[] = []
const show = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  render(
    <QueryClientProvider client={client}>
      <App>
        <DeliveryBottlesModal assignmentId={5} orderCode="DH5" onClose={() => {}} />
      </App>
    </QueryClientProvider>,
  )
}
beforeEach(() => {
  vi.spyOn(deliveryBottleApi, 'get').mockResolvedValue(data)
  vi.spyOn(deliveryBottleApi, 'receive').mockReset()
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
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  const style = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => style(element))
})
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((c) => c.clear())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('submits each bottle type and refreshes the remaining quantities after success', async () => {
  vi.mocked(deliveryBottleApi.receive).mockImplementation(async () => {
    const updated = { ...data, lines: data.lines.map((l) => ({ ...l, returned: l.given })) }
    vi.mocked(deliveryBottleApi.get).mockResolvedValue(updated)
    return updated
  })
  show()
  fireEvent.change(await screen.findByLabelText('Vỏ A — còn tối đa 2 vỏ'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Vỏ B — còn tối đa 1 vỏ'), { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đã thu vỏ' }))
  await waitFor(() =>
    expect(deliveryBottleApi.receive).toHaveBeenCalledWith(5, {
      requestId: expect.any(String),
      lines: [
        { bottleTypeId: 1, quantity: 2 },
        { bottleTypeId: 2, quantity: 1 },
      ],
    }),
  )
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Xác nhận đã thu vỏ' })).toBeNull())
})
test('preserves payload and request id on retry; changing quantities creates a new request', async () => {
  vi.mocked(deliveryBottleApi.receive).mockRejectedValue(new Error('Mất kết nối'))
  show()
  const input = await screen.findByLabelText('Vỏ A — còn tối đa 2 vỏ')
  fireEvent.change(input, { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đã thu vỏ' }))
  await waitFor(() => expect(deliveryBottleApi.receive).toHaveBeenCalledTimes(1))
  await screen.findByText('Mất kết nối')
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đã thu vỏ' }))
  await waitFor(() => expect(deliveryBottleApi.receive).toHaveBeenCalledTimes(2))
  expect(vi.mocked(deliveryBottleApi.receive).mock.calls[1][1].requestId).toBe(
    vi.mocked(deliveryBottleApi.receive).mock.calls[0][1].requestId,
  )
  await waitFor(() => expect(screen.getByRole('button', { name: 'Xác nhận đã thu vỏ' }).getAttribute('class')).not.toContain('loading'))
  fireEvent.change(input, { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đã thu vỏ' }))
  await waitFor(() => expect(deliveryBottleApi.receive).toHaveBeenCalledTimes(3))
  expect(vi.mocked(deliveryBottleApi.receive).mock.calls[2][1].requestId).not.toBe(
    vi.mocked(deliveryBottleApi.receive).mock.calls[0][1].requestId,
  )
})
test('legacy assignments explain reconciliation and do not allow automatic returns', async () => {
  vi.mocked(deliveryBottleApi.get).mockResolvedValue({ ...data, tracked: false, canReturn: false, lines: [] })
  show()
  expect(await screen.findByText('Chưa có dữ liệu liên kết vỏ')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Xác nhận đã thu vỏ' })).toBeNull()
})
test('settled trips expose history without a return action', async () => {
  vi.mocked(deliveryBottleApi.get).mockResolvedValue({
    ...data,
    canReturn: false,
    receipts: [{ requestId: 'r1', typeName: 'Vỏ A', quantity: 1, actor: 'Tài xế A', at: '2026-11-06T12:00:00Z' }],
  })
  show()
  expect(await screen.findByText('Tài xế A')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Xác nhận đã thu vỏ' })).toBeNull()
})
test('initial API failures offer a retry', async () => {
  vi.mocked(deliveryBottleApi.get).mockRejectedValueOnce(new Error('Không tải được vỏ')).mockResolvedValue(data)
  show()
  expect(await screen.findByText('Không tải được vỏ')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByLabelText('Vỏ A — còn tối đa 2 vỏ')).toBeTruthy()
})
