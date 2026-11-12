// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LiveOrderPayments } from './LiveOrderPayments'
import { paymentApi, type PaymentReceipt, type OrderBalance } from './paymentApi'
const state = vi.hoisted(() => ({ role: 'SALES_STAFF' }))
vi.mock('@/features/auth/useStaff', () => ({ useStaff: () => ({ name: 'Cashier', role: state.role }) }))
const balance: OrderBalance = { orderId: 1, orderCode: 'DH1', customerId: 2, status: 'DELIVERED', total: 100000, received: 25000, refunded: 0, paid: 25000, due: 75000, refundDue: 0 }
const receipt: PaymentReceipt = { id: 1, orderId: 1, amount: 25000, direction: 'IN', method: 'CASH', reference: null, note: null, recordedBy: 3, recordedByName: 'Driver', createdAt: '2026-11-06T01:00:00Z', source: 'DELIVERY' }
const clients: QueryClient[] = []
const show = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  render(<QueryClientProvider client={client}><App><LiveOrderPayments orderId={1} /></App></QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks(); state.role = 'SALES_STAFF'
  vi.spyOn(paymentApi, 'list').mockResolvedValue({ balance, payments: [receipt] })
  vi.spyOn(paymentApi, 'create').mockReset()
  Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })) })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  const style = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation(element => style(element))
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
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks(); vi.unstubAllGlobals() })

test('shows driver receipts and uses the API outstanding balance when collecting the remainder', async () => {
  vi.mocked(paymentApi.create).mockResolvedValue({ ...receipt, id: 2, amount: 75000, source: 'SALES' })
  show()
  expect(await screen.findByText(/Thu khi giao hàng/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận thu tiền' }))
  expect((screen.getByLabelText('Số tiền') as HTMLInputElement).value).toBe('75000.00')
  vi.mocked(paymentApi.list).mockResolvedValue({ balance: { ...balance, paid: 100000, due: 0 }, payments: [receipt] })
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đã giao dịch' }))
  await confirmDialog('Ghi nhận thu')
  await waitFor(() => expect(paymentApi.create).toHaveBeenCalledWith(1, expect.objectContaining({ amount: 75000, direction: 'IN', method: 'CASH', requestId: expect.any(String) })))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Ghi nhận thu tiền' })).toBeNull())
})
test('retries an uncertain network failure with the same idempotency key', async () => {
  vi.mocked(paymentApi.create).mockRejectedValueOnce(new Error('Mất kết nối')).mockResolvedValueOnce(receipt)
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận thu tiền' }))
  vi.mocked(paymentApi.list).mockRejectedValueOnce(new Error('Không tải lại được số dư'))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đã giao dịch' }))
  await confirmDialog('Ghi nhận thu')
  expect(await screen.findByText('Mất kết nối')).toBeTruthy()
  await waitFor(() => expect((screen.getByLabelText('Số tiền') as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đã giao dịch' }))
  await confirmDialog('Ghi nhận thu')
  await waitFor(() => expect(paymentApi.create).toHaveBeenCalledTimes(2))
  expect(vi.mocked(paymentApi.create).mock.calls[0][1].requestId).toBe(vi.mocked(paymentApi.create).mock.calls[1][1].requestId)
})
test('requires a reason before recording a refund for a cancelled order', async () => {
  vi.mocked(paymentApi.list).mockResolvedValue({ balance: { ...balance, status: 'CANCELLED', due: 0, refundDue: 25000 }, payments: [receipt] })
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận hoàn tiền' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đã giao dịch' }))
  expect(await screen.findByText('Nhập lý do hoàn tiền.')).toBeTruthy()
  expect(paymentApi.create).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Ghi nhận thu tiền' })).toBeNull()
})
test('delivery staff cannot load office payment controls', () => {
  state.role = 'DELIVERY_STAFF'; show()
  expect(paymentApi.list).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Ghi nhận thu tiền' })).toBeNull()
})
test('does not allow collection before order confirmation', async () => {
  vi.mocked(paymentApi.list).mockResolvedValue({ balance: { ...balance, status: 'PENDING' }, payments: [] })
  show()
  await screen.findByText('Chưa có phiếu thanh toán.')
  expect(screen.queryByRole('button', { name: 'Ghi nhận thu tiền' })).toBeNull()
})
test('asks for confirmation and records nothing when the cashier goes back to review', async () => {
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận thu tiền' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đã giao dịch' }))
  expect((await screen.findAllByText(/Ghi nhận đã thu .*75\.000/)).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Xem lại' }))
  // Quay lại form: không ghi phiếu, form mở lại để sửa.
  await waitFor(() => expect((screen.getByLabelText('Số tiền') as HTMLInputElement).disabled).toBe(false))
  expect(paymentApi.create).not.toHaveBeenCalled()
  // Hộp vừa bỏ qua vẫn nằm trong DOM: không tính là hộp mới.
  screen.queryAllByRole('button', { name: 'Ghi nhận thu' }).forEach((button) => clickedConfirms.add(button))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đã giao dịch' }))
  await confirmDialog('Ghi nhận thu')
  await waitFor(() => expect(paymentApi.create).toHaveBeenCalledTimes(1))
})
