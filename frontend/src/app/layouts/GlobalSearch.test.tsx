// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { GlobalSearch } from './GlobalSearch'

const opened = vi.fn()
const searchedOrders = vi.fn()
const searchedCustomers = vi.fn()

vi.mock('@/features/auth/useStaff', () => ({ useStaff: () => ({ role: 'SALES_STAFF', name: 'Trang' }) }))
// Đơn và khách tìm ở BE: giả lập lọc như server theo từ khóa nhận được; debounce bỏ qua trong test.
vi.mock('@/shared/hooks/useDebouncedValue', () => ({ useDebouncedValue: <T,>(value: T) => value }))
vi.mock('@/features/orders/orderData', async () => {
  const { matchesSearch } = await import('@/shared/utils/search')
  const orders = [{ id: '7', code: 'DH-007', customer: 'Nguyễn Lan', phone: '0901234567', status: 'Chờ xác nhận' }]
  return {
    useOrderPage: (filters: { query: string; group: string }, page: number, size: number) => {
      searchedOrders(filters, page, size)
      const hits = orders.filter((order) => matchesSearch(filters.query, `${order.code} ${order.customer} ${order.phone}`, order.phone))
      return { data: { orders: hits, total: hits.length, serverPaged: true }, isPending: false, isError: false }
    },
  }
})
vi.mock('@/features/customers/useCustomers', async () => {
  const { matchesSearch } = await import('@/shared/utils/search')
  const customers = [{ id: '3', name: 'Trần Bình', phone: '0912000111' }]
  return {
    useCustomerSearch: (query: string, size: number) => {
      searchedCustomers(query, size)
      const hits = query ? customers.filter((customer) => matchesSearch(query, `${customer.name} ${customer.phone}`, customer.phone)) : []
      return { data: query ? { customers: hits, total: hits.length } : undefined, isPending: false, isError: false }
    },
  }
})
vi.mock('@/features/inventory/useProductCatalog', () => ({
  useCanManageProducts: () => true,
  useCatalog: () => ({
    data: [
      { id: '1', sku: 'N20', name: 'Nước 20L', active: true },
      { id: '2', sku: 'N5', name: 'Nước 5L ngừng bán', active: false },
    ],
    isPending: false,
    isError: false,
  }),
}))
vi.mock('@/features/orders/components/OrderDetails', () => ({
  OrderDetails: ({ id }: { id: string }) => {
    opened(id)
    return <div>Chi tiết {id}</div>
  },
}))

function Where() {
  const { pathname, search } = useLocation()
  return <div data-testid="where">{pathname + decodeURIComponent(search)}</div>
}
const open = () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <GlobalSearch />
      <Where />
    </MemoryRouter>,
  )
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
  return screen.getByRole('textbox', { name: 'Tìm nhanh' })
}

beforeAll(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
})
afterEach(cleanup)

describe('GlobalSearch', () => {
  it('opens with Ctrl+K and hides pages the role cannot open', () => {
    open()
    expect(screen.getByRole('option', { name: /Đơn hàng/ })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /Báo cáo/ })).toBeNull()
    expect(screen.queryByRole('option', { name: /Nhật ký/ })).toBeNull()
  })

  it('finds an order by phone number and opens its details with Enter', () => {
    const input = open()
    fireEvent.change(input, { target: { value: '0901 234' } })
    expect(screen.getByRole('option', { name: /DH-007/ })).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Chi tiết 7')).toBeTruthy()
  })

  it('searches all orders and customers on the server with the typed keyword', () => {
    const input = open()
    fireEvent.change(input, { target: { value: '  trần bình ' } })
    expect(searchedOrders).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'trần bình', group: 'all' }), 0, 5)
    expect(searchedCustomers).toHaveBeenLastCalledWith('trần bình', 5)
    expect(screen.getByRole('option', { name: /Trần Bình/ })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /DH-007/ })).toBeNull()
  })

  it('moves through results with the arrow keys', () => {
    const input = open()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('where').textContent).toBe('/orders')
  })

  it('links an active product to its filtered page and skips inactive ones', () => {
    const input = open()
    fireEvent.change(input, { target: { value: 'nuoc' } })
    expect(screen.queryByRole('option', { name: /ngừng bán/ })).toBeNull()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('where').textContent).toBe('/products?q=Nước 20L')
  })

  it('reports when nothing matches', () => {
    fireEvent.change(open(), { target: { value: 'khong-co-gi' } })
    expect(screen.getByRole('status').textContent).toBe('Không tìm thấy kết quả phù hợp.')
  })
})
