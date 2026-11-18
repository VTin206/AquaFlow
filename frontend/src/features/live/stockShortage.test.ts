import { QueryClient } from '@tanstack/react-query'
import { expect, test, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import { catalogApi } from './catalogApi'
import { explainStockShortage, stockShortageMessage } from './stockShortage'

vi.mock('./catalogApi', () => ({ catalogApi: { products: vi.fn() } }))
const nameOf = (id: number) => (id === 63 ? 'Nước LaVie 19L' : undefined)

test('names the product and says it is out of stock or how many are left', () => {
  expect(stockShortageMessage('Sản phẩm 63 chỉ còn 0 có thể bán, không đủ 1', nameOf)).toBe(
    'Chưa xác nhận được đơn: "Nước LaVie 19L" đã hết hàng (đơn cần 1).',
  )
  expect(stockShortageMessage('Sản phẩm 63 chỉ còn 2 có thể bán, không đủ 5', nameOf)).toBe(
    'Chưa xác nhận được đơn: "Nước LaVie 19L" chỉ còn 2, đơn cần 5.',
  )
})

test('falls back to the product code and leaves other messages untouched', () => {
  expect(stockShortageMessage('Sản phẩm 7 chỉ còn 0 có thể bán, không đủ 3', nameOf)).toBe(
    'Chưa xác nhận được đơn: "Sản phẩm #7" đã hết hàng (đơn cần 3).',
  )
  expect(stockShortageMessage('Đơn đã được xác nhận', nameOf)).toBe('Đơn đã được xác nhận')
})

test('rethrows shortage errors with the catalog name and keeps the status; other errors pass through', async () => {
  vi.mocked(catalogApi.products).mockResolvedValue([{ id: 63, name: 'Nước LaVie 19L' }] as never)
  const client = new QueryClient()
  const shortage = await explainStockShortage(new ApiError(409, 'Sản phẩm 63 chỉ còn 0 có thể bán, không đủ 1'), client).catch(
    (error: unknown) => error,
  )
  expect(shortage).toBeInstanceOf(ApiError)
  expect((shortage as ApiError).status).toBe(409)
  expect((shortage as ApiError).message).toBe('Chưa xác nhận được đơn: "Nước LaVie 19L" đã hết hàng (đơn cần 1).')
  const other = new ApiError(409, 'Đơn đã đổi trạng thái')
  await expect(explainStockShortage(other, client)).rejects.toBe(other)
})
