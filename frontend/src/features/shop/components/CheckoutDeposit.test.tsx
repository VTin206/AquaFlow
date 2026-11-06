// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CheckoutDeposit } from './CheckoutDeposit'
import { bottleTypeApi } from '@/features/live/bottleTypeApi'
import type { CheckoutLine } from './CheckoutReview'
import { currency } from '@/shared/utils/format'

vi.mock('../shopService', () => ({ useShopDemo: () => false }))
const clients: QueryClient[] = []
const lines: CheckoutLine[] = [
  { productId: '1', quantity: 2, product: { id: '1', sku: 'A', name: 'Nước A', brand: '', unit: 'Bình', price: 20000, available: true, bottleTypeId: 1 } },
  { productId: '2', quantity: 1, product: { id: '2', sku: 'B', name: 'Nước B', brand: '', unit: 'Bình', price: 30000, available: true, bottleTypeId: 2 } },
]
const types = [{ id: 1, name: 'Vỏ A', depositUnitAmount: 40000, active: true }, { id: 2, name: 'Vỏ B', depositUnitAmount: 70000, active: true }]
function show(items = lines) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  render(<QueryClientProvider client={client}><CheckoutDeposit lines={items} /></QueryClientProvider>)
  return client
}
beforeEach(() => { vi.spyOn(bottleTypeApi, 'list').mockResolvedValue(types) })
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); vi.restoreAllMocks() })
test('uses API rates per type, aggregates products sharing a shell and refreshes changed rates', async () => {
  const client = show([...lines, { ...lines[0], productId: '3', quantity: 1 }])
  expect(await screen.findByText(`Vỏ A: 3 vỏ × ${currency(40000)} = ${currency(120000)}`)).toBeTruthy()
  expect(screen.getByText(`Cọc dự kiến khi không đổi vỏ: ${currency(190000)}`)).toBeTruthy()
  vi.mocked(bottleTypeApi.list).mockResolvedValue([{ ...types[0], depositUnitAmount: 50000 }, types[1]])
  await client.invalidateQueries()
  await waitFor(() => expect(screen.getByText(`Cọc dự kiến khi không đổi vỏ: ${currency(220000)}`)).toBeTruthy())
})
test('does not fetch deposits for products with no shell type', () => {
  show([{ ...lines[0], product: { ...lines[0].product!, bottleTypeId: null } }])
  expect(bottleTypeApi.list).not.toHaveBeenCalled()
  expect(screen.queryByText(/Cọc dự kiến khi không đổi vỏ:/)).toBeNull()
})
test('does not present a misleading total when one type is unavailable; zero rate remains valid', async () => {
  vi.mocked(bottleTypeApi.list).mockResolvedValue([{ ...types[0], depositUnitAmount: 0 }])
  show()
  expect(await screen.findByText(/chưa có giá cọc khả dụng/)).toBeTruthy()
  expect(screen.getByText(`Vỏ A: 2 vỏ × ${currency(0)} = ${currency(0)}`)).toBeTruthy()
  expect(screen.queryByText(/Cọc dự kiến khi không đổi vỏ:/)).toBeNull()
})
test('shows loading and offers retry on API failure instead of a fixed price', async () => {
  vi.mocked(bottleTypeApi.list).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(types)
  show()
  expect(screen.getByRole('status')).toBeTruthy()
  expect(await screen.findByRole('alert')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại giá cọc' }))
  expect(await screen.findByText(`Cọc dự kiến khi không đổi vỏ: ${currency(150000)}`)).toBeTruthy()
})
