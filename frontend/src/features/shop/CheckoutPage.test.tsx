// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CheckoutPage } from './CheckoutPage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { customerAccountApi } from './customerAccountApi'
import { deliveryQuoteApi } from './deliveryQuoteApi'
vi.mock('./deliveryQuoteApi', () => ({ deliveryQuoteApi: { quote: vi.fn() } }))
vi.mock('./customerAccountApi', async original => ({
  ...(await original<typeof import('./customerAccountApi')>()),
  customerAccountApi: { addresses: vi.fn().mockResolvedValue([]) },
}))

const mocks = vi.hoisted(() => ({
  user: null as null | { name: string; role: string; email?: string; phone?: string | null },
  profile: null as null | { customer: string; phone: string; address: string; area: string },
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
/** Chọn phường/xã trong ô chọn: gõ không dấu để lọc rồi bấm đúng mục. */
const pickWard = async (search: string, ward: string) => {
  const box = screen.getByLabelText('Phường/Xã')
  fireEvent.mouseDown(box)
  fireEvent.change(box, { target: { value: search } })
  fireEvent.click(await screen.findByTitle(ward))
}
const fillDelivery = async () => {
  type('Địa chỉ giao', '12 Đường Test')
  await pickWard('ben thanh', 'Phường Bến Thành')
}
const placeOrder = async () => {
  await waitFor(() => expect((screen.getAllByRole('button', { name: /Đặt đơn/ })[0] as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getAllByRole('button', { name: /Đặt đơn/ })[0])
}

afterEach(cleanup)
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  mocks.user = null
  vi.mocked(deliveryQuoteApi.quote).mockReset().mockResolvedValue({ subtotal: 100000, baseFee: 15000, stairsFee: 0, deliveryFee: 15000, total: 115000 })
  vi.mocked(customerAccountApi.addresses).mockReset().mockResolvedValue([])
  mocks.profile = null
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
  await placeOrder()
  await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ customer: 'Người nhận khác', phone: '0905555555', address: 'Địa chỉ đã lưu', area: 'Quận 3' })))
})

test('giao sớm nhất không gửi giờ hẹn, đơn gửi đúng thông tin đã nhập', async () => {
  renderPage()
  type('Tên người nhận', ' Khách Thử ')
  type('Số điện thoại', '090 123 4567')
  await fillDelivery()
  await placeOrder()
  await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1))
  expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({ customer: 'Khách Thử', phone: '0901234567', address: '12 Đường Test', area: 'Phường Bến Thành', appointment: undefined })
})

test('chọn giờ thì bắt buộc có giờ, chưa chọn không tạo đơn', async () => {
  renderPage()
  type('Tên người nhận', 'Khách Thử')
  type('Số điện thoại', '0901234567')
  await fillDelivery()
  fireEvent.click(screen.getByLabelText('Chọn giờ'))
  await placeOrder()
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

test('chưa báo được phí giao thì ghi tạm tính và khóa đặt đơn', () => {
  vi.mocked(deliveryQuoteApi.quote).mockReturnValue(new Promise(() => {}))
  renderPage()
  expect(screen.getAllByText('Chưa có báo phí').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Tạm tính').length).toBeGreaterThan(0)
  expect(screen.queryByText('Tổng cộng')).toBeNull()
  expect(screen.getByText('Thanh toán khi nhận hàng')).toBeTruthy()
  expect((screen.getAllByRole('button', { name: /Đặt đơn/ })[0] as HTMLButtonElement).disabled).toBe(true)
})

test('đổi tầng tải phí mới và gửi tổng tiền đã báo khi đặt đơn', async () => {
  renderPage()
  await waitFor(() => expect(deliveryQuoteApi.quote).toHaveBeenCalledWith([{ productId: 1, quantity: 2 }], 0))
  vi.mocked(deliveryQuoteApi.quote).mockResolvedValue({ subtotal: 100000, baseFee: 15000, stairsFee: 16000, deliveryFee: 31000, total: 131000 })
  fireEvent.change(screen.getByLabelText('Số tầng phải đi thang bộ'), { target: { value: '3' } })
  await waitFor(() => expect(deliveryQuoteApi.quote).toHaveBeenLastCalledWith([{ productId: 1, quantity: 2 }], 3))
  type('Tên người nhận', 'Khách Test')
  type('Số điện thoại', '0901234567')
  await fillDelivery()
  await placeOrder()
  await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ floor: 3, expectedTotal: 131000 })))
})

test('lỗi báo phí khóa đặt đơn đến khi tải lại thành công', async () => {
  vi.mocked(deliveryQuoteApi.quote).mockRejectedValueOnce(new Error('Lỗi báo phí'))
  renderPage()
  await screen.findByText('Lỗi báo phí')
  expect((screen.getAllByRole('button', { name: /Đặt đơn/ })[0] as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: /Thử lại/ }))
  await waitFor(() => expect((screen.getAllByRole('button', { name: /Đặt đơn/ })[0] as HTMLButtonElement).disabled).toBe(false))
})

test('dòng cách tính phí lấy theo mức phí cửa hàng trong báo giá', async () => {
  vi.mocked(deliveryQuoteApi.quote).mockResolvedValue({
    subtotal: 100000,
    baseFee: 20000,
    stairsFee: 0,
    deliveryFee: 20000,
    total: 120000,
    fees: { freeFromUnits: 5, smallOrderFee: 20000, stairsPerJug: [1000, 7000] },
  })
  renderPage()
  expect(await screen.findByText(/Dưới 5 sản phẩm: 20\.000\s₫ · Từ 5 sản phẩm: miễn phí/)).toBeTruthy()
  expect(screen.getByText(/Lầu 1: 1\.000\s₫ · Từ lầu 2: 7\.000\s₫ mỗi bình\/thùng/)).toBeTruthy()
  expect(screen.queryByText(/Dưới 3 sản phẩm/)).toBeNull()
})
