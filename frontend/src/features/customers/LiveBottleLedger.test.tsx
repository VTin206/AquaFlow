// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LiveBottleLedger } from './LiveBottleLedger'
import { bottleLedgerApi, type BottleLedger } from '@/features/live/bottleLedgerApi'
const state = vi.hoisted(() => ({ role: 'ADMIN' }))
vi.mock('@/features/auth/useStaff', () => ({ useStaff: () => ({ name: 'Cashier', role: state.role }) }))
const ledger: BottleLedger = {
  balance: { customerId: 2, name: 'Khách A', active: true, bottlesHeld: 1, depositHeld: 100000, requiredDeposit: 50000, refundable: 50000 },
  types: [{ bottleTypeId: 1, name: 'Vỏ 20L', active: true, held: 1, unitAmount: 50000, liability: 50000 }],
  entries: [
    {
      id: 'one',
      kind: 'GIVE',
      bottleType: 'Vỏ 20L',
      bottles: 1,
      deposit: 0,
      note: 'Đơn DH1',
      actor: 'Cashier',
      at: '2026-11-06T00:00:00Z',
    },
  ],
}
const clients: QueryClient[] = []
const show = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  render(
    <QueryClientProvider client={client}>
      <App>
        <LiveBottleLedger customerId={2} />
      </App>
    </QueryClientProvider>,
  )
}
beforeEach(() => {
  state.role = 'ADMIN'
  vi.spyOn(bottleLedgerApi, 'ledger').mockResolvedValue(ledger)
  vi.spyOn(bottleLedgerApi, 'create').mockReset()
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
// Hộp xác nhận cũ còn trong DOM sau khi đóng: chỉ bấm nút của hộp mới mở.
const clickedConfirms = new WeakSet<HTMLElement>()
const confirmDialog = async (name: string) => {
  const button = await waitFor(() => {
    const fresh = screen.getAllByRole('button', { name }).filter((item) => !clickedConfirms.has(item))
    if (!fresh.length) throw new Error(`Chưa thấy hộp xác nhận "${name}"`)
    return fresh[fresh.length - 1]
  })
  clickedConfirms.add(button)
  fireEvent.click(button)
}
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((c) => c.clear())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('shows real types and history and hides privileged actions for sales staff', async () => {
  state.role = 'SALES_STAFF'
  show()
  expect(await screen.findByText(/Đơn DH1/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Thu vỏ' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Hoàn cọc' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Báo mất/vỡ' })).toBeNull()
})
test('requires a refund reason and reuses request id on retry without losing the form', async () => {
  vi.mocked(bottleLedgerApi.create).mockRejectedValueOnce(new Error('Mất kết nối')).mockResolvedValueOnce(ledger.entries[0])
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Hoàn cọc' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận ghi nhận' }))
  expect(await screen.findByText('Nhập lý do hoặc mã đơn.')).toBeTruthy()
  expect(bottleLedgerApi.create).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Lý do / mã đơn để đối chiếu'), { target: { value: 'Đã trả vỏ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận ghi nhận' }))
  await confirmDialog('Ghi vào sổ')
  await waitFor(() => expect(bottleLedgerApi.create).toHaveBeenCalledTimes(1))
  const first = vi.mocked(bottleLedgerApi.create).mock.calls[0][1]
  expect(first.amount).toBe(50000)
  expect(first.kind).toBe('REFUND')
  await screen.findByText('Mất kết nối')
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận ghi nhận' }))
  await confirmDialog('Ghi vào sổ')
  await waitFor(() => expect(bottleLedgerApi.create).toHaveBeenCalledTimes(2))
  expect(vi.mocked(bottleLedgerApi.create).mock.calls[1][1].requestId).toBe(first.requestId)
})
test('disables refund with no refundable deposit and returns with no held bottles', async () => {
  vi.mocked(bottleLedgerApi.ledger).mockResolvedValue({ ...ledger, balance: { ...ledger.balance, bottlesHeld: 0, refundable: 0 } })
  show()
  expect(((await screen.findByRole('button', { name: 'Hoàn cọc' })) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Thu vỏ' }) as HTMLButtonElement).disabled).toBe(true)
})
test('shows load errors and lets staff retry', async () => {
  vi.mocked(bottleLedgerApi.ledger).mockRejectedValueOnce(new Error('Không tải được sổ')).mockResolvedValue(ledger)
  show()
  expect(await screen.findByText('Không tải được sổ')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Thử lại/ }))
  expect(await screen.findByText(/Đơn DH1/)).toBeTruthy()
})
