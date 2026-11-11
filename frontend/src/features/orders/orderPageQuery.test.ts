import { describe, expect, it, vi } from 'vitest'
import { isServerPagedGroup, matchesOrderFilters, toOrderPageQuery, type OrderListFilters } from './orderData'
import { serverTablePagination } from '@/shared/utils/table'
import type { Order } from './types'

const all: OrderListFilters = { query: '', group: 'all', status: 'Tất cả', method: 'Tất cả', payment: 'Tất cả' }

describe('toOrderPageQuery', () => {
  it('sends no status filter for "Tất cả" so cancelled orders are included', () => {
    expect(toOrderPageQuery(all, 2, 20)).toEqual({ page: 2, size: 20, statuses: undefined, fulfillment: undefined, payment: undefined, q: '' })
  })

  it('expands a group into its backend statuses and maps method, payment and keyword', () => {
    expect(toOrderPageQuery({ query: ' Lan ', group: 'done', status: 'Tất cả', method: 'Giao tận nơi', payment: 'Còn phải thu' }, 0, 10)).toEqual({
      page: 0,
      size: 10,
      statuses: ['DELIVERED', 'COMPLETED'],
      fulfillment: 'DELIVERY',
      payment: 'DUE',
      q: ' Lan ',
    })
    expect(toOrderPageQuery({ ...all, status: 'Đã hủy', method: 'Tại quầy', payment: 'Đã thanh toán' }, 0, 10)).toMatchObject({
      statuses: ['CANCELLED'],
      fulfillment: 'COUNTER',
      payment: 'SETTLED',
    })
  })

  it('returns null instead of an unfiltered request when only a status unknown to the backend is chosen', () => {
    expect(toOrderPageQuery({ ...all, group: 'need', status: 'Giao thất bại' }, 0, 10)).toBeNull()
    // "Cần xử lý" vẫn gửi được phần trạng thái BE có.
    expect(toOrderPageQuery({ ...all, group: 'need' }, 0, 10)?.statuses).toEqual(['PENDING'])
  })
})

describe('order list modes', () => {
  it('pages only the history groups on the server', () => {
    expect(isServerPagedGroup('need')).toBe(false)
    expect(isServerPagedGroup('active')).toBe(false)
    expect(isServerPagedGroup('done')).toBe(true)
    expect(isServerPagedGroup('all')).toBe(true)
  })

  it('filters working-set orders in the browser with the same rules as the backend', () => {
    const order = {
      id: '1',
      code: 'AF-000001',
      customer: 'Nguyễn Lan',
      phone: '0901234567',
      items: 'Nước khoáng × 2',
      status: 'Đã xác nhận',
      method: 'Giao tận nơi',
      total: 100000,
      payments: [],
      paymentBalance: { paid: 0, due: 100000, refundDue: 0 },
    } as unknown as Order
    const active: OrderListFilters = { ...all, group: 'active' }
    expect(matchesOrderFilters(order, { ...active, query: 'nuoc khoang', payment: 'Còn phải thu' })).toBe(true)
    expect(matchesOrderFilters(order, { ...active, query: '+84 901 234 567' })).toBe(true)
    expect(matchesOrderFilters(order, { ...active, payment: 'Đã thanh toán' })).toBe(false)
    expect(matchesOrderFilters(order, { ...active, group: 'need' })).toBe(false)
  })
})

describe('serverTablePagination', () => {
  it('converts between 0-based server pages and 1-based table pages and resets to the first page on size change', () => {
    const onChange = vi.fn()
    const config = serverTablePagination({ page: 2, size: 10, total: 95, onChange })
    expect(config).toMatchObject({ current: 3, pageSize: 10, total: 95 })
    config.onChange?.(5, 10)
    expect(onChange).toHaveBeenLastCalledWith(4, 10)
    config.onChange?.(3, 50)
    expect(onChange).toHaveBeenLastCalledWith(0, 50)
  })
})
