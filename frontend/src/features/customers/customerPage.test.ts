import { describe, expect, it } from 'vitest'
import { cardSortOrder, fromSummary, pageDemoCustomers, type CustomerPageFilters } from './useCustomers'
import type { Customer } from './types'

const customer = (id: string, name: string, extra: Partial<Customer> = {}) =>
  ({ id, name, phone: '', area: '', orders: 0, debt: 0, bottlesHeld: 0, depositHeld: 0, ...extra }) as Customer

const customers = [
  customer('1', 'Trần Thị Hoa', { orders: 1, lastOrderAt: '2026-11-01T08:00:00+07:00', debt: 50000 }),
  customer('2', 'Ánh Dương'),
  customer('3', 'Bùi Văn An', { orders: 4, lastOrderAt: '2026-11-10T08:00:00+07:00', bottlesHeld: 3, depositHeld: 150000 }),
]
const none: CustomerPageFilters = { query: '', idle: 'all' }
const names = (filters: CustomerPageFilters, page = 0, size = 10) => pageDemoCustomers(customers, filters, page, size).customers.map((c) => c.name)

describe('pageDemoCustomers', () => {
  it('sorts by Vietnamese name without a column sort, like the backend default', () => {
    expect(names(none)).toEqual(['Ánh Dương', 'Bùi Văn An', 'Trần Thị Hoa'])
  })

  it('sorts across the whole list before paging, treating never-ordered as smallest', () => {
    expect(names({ ...none, sort: { key: 'orders', order: 'descend' } }, 0, 2)).toEqual(['Bùi Văn An', 'Trần Thị Hoa'])
    expect(names({ ...none, sort: { key: 'orders', order: 'descend' } }, 1, 2)).toEqual(['Ánh Dương'])
    expect(names({ ...none, sort: cardSortOrder.idle })).toEqual(['Ánh Dương', 'Trần Thị Hoa', 'Bùi Văn An'])
    expect(names({ ...none, sort: cardSortOrder.recent })).toEqual(['Bùi Văn An', 'Trần Thị Hoa', 'Ánh Dương'])
  })

  it('filters by keyword and idle state but keeps totals over every customer', () => {
    const page = pageDemoCustomers(customers, { query: 'an', idle: 'never' }, 0, 10)
    expect(page.customers.map((c) => c.name)).toEqual(['Ánh Dương'])
    expect(page.total).toBe(1)
    expect(page.totals).toEqual({ customers: 3, due: 50000, bottlesHeld: 3, depositHeld: 150000 })
  })
})

describe('fromSummary', () => {
  it('maps backend statistics onto the customer used by the screens', () => {
    const mapped = fromSummary({
      id: 7,
      fullName: 'Nguyễn Văn Đức',
      phone: '0901234567',
      createdAt: '2026-01-01T00:00:00Z',
      customerType: 'Doanh nghiệp',
      area: null,
      note: null,
      orderCount: 3,
      lastOrderAt: '2026-11-10T08:00:00+07:00',
      lastDeliveryAddress: '99 Lê Lợi',
      due: 50000,
      bottlesHeld: 2,
      depositHeld: 100000,
    })
    expect(mapped).toMatchObject({
      id: '7',
      name: 'Nguyễn Văn Đức',
      type: 'Doanh nghiệp',
      orders: 3,
      lastOrderAt: '2026-11-10T08:00:00+07:00',
      mainAddress: '99 Lê Lợi',
      debt: 50000,
      bottlesHeld: 2,
      depositHeld: 100000,
    })
  })
})
