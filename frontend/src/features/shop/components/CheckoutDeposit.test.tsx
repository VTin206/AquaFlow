// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useShellDeposit } from './CheckoutDeposit'
import { bottleTypeApi } from '@/features/live/bottleTypeApi'
import type { CheckoutLine } from './CheckoutReview'

const clients: QueryClient[] = []
const lines: CheckoutLine[] = [
  { productId: '1', quantity: 2, product: { id: '1', sku: 'A', name: 'Nước A', brand: '', unit: 'Bình', price: 20000, available: true, bottleTypeId: 1 } },
  { productId: '2', quantity: 1, product: { id: '2', sku: 'B', name: 'Nước B', brand: '', unit: 'Bình', price: 30000, available: true, bottleTypeId: 2 } },
]
const types = [{ id: 1, name: 'Vỏ A', depositUnitAmount: 40000, active: true }, { id: 2, name: 'Vỏ B', depositUnitAmount: 70000, active: true }]

function Probe({ items }: { items: CheckoutLine[] }) {
  const deposit = useShellDeposit(items)
  return <output>{`${deposit.status}:${deposit.count}:${deposit.amount ?? '-'}`}</output>
}
function show(items = lines) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  render(<QueryClientProvider client={client}><Probe items={items} /></QueryClientProvider>)
  return client
}
beforeEach(() => { vi.spyOn(bottleTypeApi, 'list').mockResolvedValue(types) })
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); vi.restoreAllMocks() })

test('cộng cọc theo giá từng loại vỏ, gộp sản phẩm cùng loại vỏ và cập nhật khi giá đổi', async () => {
  const client = show([...lines, { ...lines[0], productId: '3', quantity: 1 }])
  expect(await screen.findByText('ready:4:190000')).toBeTruthy()
  vi.mocked(bottleTypeApi.list).mockResolvedValue([{ ...types[0], depositUnitAmount: 50000 }, types[1]])
  await client.invalidateQueries()
  await waitFor(() => expect(screen.getByText('ready:4:220000')).toBeTruthy())
})
test('không gọi giá cọc khi giỏ không có sản phẩm đổi vỏ', () => {
  show([{ ...lines[0], product: { ...lines[0].product!, bottleTypeId: null } }])
  expect(bottleTypeApi.list).not.toHaveBeenCalled()
  expect(screen.getByText('none:0:-')).toBeTruthy()
})
test('thiếu giá của một loại vỏ thì không đưa ra tổng có thể sai; giá 0 vẫn hợp lệ', async () => {
  vi.mocked(bottleTypeApi.list).mockResolvedValue([{ ...types[0], depositUnitAmount: 0 }])
  show()
  expect(await screen.findByText('partial:3:-')).toBeTruthy()
  cleanup()
  show([lines[0]])
  expect(await screen.findByText('ready:2:0')).toBeTruthy()
})
test('đang tải rồi báo lỗi khi không lấy được giá cọc', async () => {
  vi.mocked(bottleTypeApi.list).mockRejectedValue(new Error('offline'))
  show()
  expect(screen.getByText('loading:3:-')).toBeTruthy()
  expect(await screen.findByText('error:3:-')).toBeTruthy()
})
