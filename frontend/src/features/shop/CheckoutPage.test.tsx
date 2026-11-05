// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CheckoutPage } from './CheckoutPage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { customerAccountApi } from './customerAccountApi'
vi.mock('./customerAccountApi', async original => ({
  ...(await original<typeof import('./customerAccountApi')>()),
  customerAccountApi: { addresses: vi.fn().mockResolvedValue([]) },
}))

const mocks = vi.hoisted(() => ({
  user: null as null | { name: string; role: string; email?: string; phone?: string | null },
  profile: null as null | { customer: string; phone: string; address: string; area: string },
  feeQuoted: false,
  mutateAsync: vi.fn(),
}))

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('react-router', async (original) => ({
  ...(await original<typeof import('react-router')>()),
  useOutletContext: () => ({ openCart: vi.fn() }),
}))
vi.mock('./cart', () => ({
  readProfile: () => mocks.profile,
  saveProfile: vi.fn(),
  useCart: () => [{ productId: '1', quantity: 2 }],
  useCartActions: () => ({ clear: vi.fn() }),
}))
vi.mock('./shopService', () => ({
  useShopContact: () => ({ openingHours: '6:00 – 21:00 hằng ngày' }),
  useShopFeature: (name: string) => (name === 'deliveryQuote' ? mocks.feeQuoted : false),
  useShopProducts: () => ({ data: [{ id: '1', name: 'Nước 19L', price: 50000, unit: 'Bình', available: true }], isPending: false, isError: false }),
  usePlaceWebOrder: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}))

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App>
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>
    </App></QueryClientProvider>,
  )
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const fillDelivery = () => {
  type('Địa chỉ giao', '12 Đường Test')
  type('Khu vực', 'Quận 1')
}
const placeOrder = () => fireEvent.click(screen.getAllByRole('button', { name: /Đặt đơn/ })[0])

afterEach(cleanup)
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  mocks.user = null
  vi.mocked(customerAccountApi.addresses).mockReset().mockResolvedValue([])
  mocks.profile = null
  mocks.feeQuoted = false
  mocks.mutateAsync.mockReset()
  mocks.mutateAsync.mockResolvedValue({ id: 5, orderCode: 'AF-5' })
})

test('chọn địa chỉ đã lưu điền người nhận và địa chỉ vào đơn thật', async () => {
  mocks.user = { name: 'Customer', role: 'CUSTOMER', email: 'k@example.com', phone: '0901234567' }
  vi.mocked(customerAccountApi.addresses).mockResolvedValue([{ id: 1, customerId: 2, recipientName: 'Người nhận khác', recipientPhone: '0905555555', addressLine: 'Địa chỉ đã lưu', area: 'Quận 3', isDefault: true }])
  renderPage()
  fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Chọn địa chỉ đã lưu' }))
  fireEvent.click(await screen.findByText('Mặc định · Người nhận khác · Địa chỉ đã lưu, Quận 3'))
  expect((screen.getByLabelText('Tên người nhận') as HTMLInputElement).value).toBe('Người nhận khác')
  expect((screen.getByLabelText('Địa chỉ giao') as HTMLInputElement).value).toBe('Địa chỉ đã lưu')
  placeOrder()
  await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ customer: 'Người nhận khác', phone: '0905555555', address: 'Địa chỉ đã lưu', area: 'Quận 3' })))
})

test('giao sớm nhất không gửi giờ hẹn, đơn gửi đúng thông tin đã nhập', async () => {
  renderPage()
  type('Tên người nhận', ' Khách Thử ')
  type('Số điện thoại', '090 123 4567')
  fillDelivery()
  placeOrder()
  await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1))
  expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({ customer: 'Khách Thử', phone: '0901234567', address: '12 Đường Test', area: 'Quận 1', appointment: undefined })
})

test('chọn giờ thì bắt buộc có giờ, chưa chọn không tạo đơn', async () => {
  renderPage()
  type('Tên người nhận', 'Khách Thử')
  type('Số điện thoại', '0901234567')
  fillDelivery()
  fireEvent.click(screen.getByLabelText('Chọn giờ'))
  placeOrder()
  expect(await screen.findByText('Chọn giờ nhận hàng.')).toBeTruthy()
  expect(mocks.mutateAsync).not.toHaveBeenCalled()
})

test('Enter ở ô chọn không gửi form', () => {
  renderPage()
  // fireEvent trả false nghĩa là đã chặn hành vi mặc định (trình duyệt tự gửi form).
  expect(fireEvent.keyDown(screen.getByLabelText('Giao sớm nhất'), { key: 'Enter' })).toBe(false)
  expect(fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'Enter' })).toBe(false)
  expect(mocks.mutateAsync).not.toHaveBeenCalled()
})

test('khách đã đăng nhập được điền sẵn tên và số điện thoại; thông tin lưu trên máy được ưu tiên', () => {
  mocks.user = { name: 'Khách Tài Khoản', role: 'CUSTOMER', email: 'k@example.com', phone: '0900000009' }
  const first = renderPage()
  expect((screen.getByLabelText('Tên người nhận') as HTMLInputElement).value).toBe('Khách Tài Khoản')
  expect((screen.getByLabelText('Số điện thoại') as HTMLInputElement).value).toBe('0900000009')
  first.unmount()

  mocks.profile = { customer: 'Người Nhận Đã Lưu', phone: '0900000001', address: 'A', area: 'B' }
  renderPage()
  expect((screen.getByLabelText('Tên người nhận') as HTMLInputElement).value).toBe('Người Nhận Đã Lưu')
})

test('tài khoản không có họ tên thì không lấy email làm tên người nhận', () => {
  mocks.user = { name: 'k@example.com', role: 'CUSTOMER', email: 'k@example.com', phone: null }
  renderPage()
  expect((screen.getByLabelText('Tên người nhận') as HTMLInputElement).value).toBe('')
})

test('chưa báo được phí giao thì ghi tạm tính và không tự cộng phí', () => {
  renderPage()
  expect(screen.getAllByText('Cửa hàng báo khi xác nhận').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Tạm tính').length).toBeGreaterThan(0)
  expect(screen.queryByText('Tổng cộng')).toBeNull()
  expect(screen.getByText('Thanh toán khi nhận hàng')).toBeTruthy()
})
