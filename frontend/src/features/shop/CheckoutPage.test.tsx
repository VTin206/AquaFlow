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
  customerAccountApi: { addresses: vi.fn().mockResolvedValue([]), createAddress: vi.fn().mockResolvedValue({}) },
}))

const mocks = vi.hoisted(() => ({
  user: null as null | { name: string; role: string; email?: string; phone?: string | null },
  profile: null as null | { customer: string; phone: string; address: string; area: string },
  mutateAsync: vi.fn(),
  bank: undefined as undefined | { bankName: string; bankAccount: string; bankHolder: string },
  bottleTypeId: undefined as number | undefined,
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
  useShopProducts: () => ({ data: [{ id: '1', name: 'Nước 19L', price: 50000, unit: 'Bình', available: true, bottleTypeId: mocks.bottleTypeId }], isPending: false, isError: false }),
  usePlaceWebOrder: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
  useTransferAccount: () => mocks.bank,
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
  vi.mocked(customerAccountApi.createAddress).mockClear()
  mocks.profile = null
  mocks.bottleTypeId = undefined
  mocks.bank = { bankName: 'MB', bankAccount: '123', bankHolder: 'AQUAFLOW' }
  mocks.mutateAsync.mockReset()
  mocks.mutateAsync.mockResolvedValue({ id: 5, orderCode: 'AF-5' })
})

test('chọn địa chỉ đã lưu điền người nhận và địa chỉ vào đơn thật', async () => {
  mocks.user = { name: 'Customer', role: 'CUSTOMER', email: 'k@example.com', phone: '0901234567' }
  vi.mocked(customerAccountApi.addresses).mockResolvedValue([{ id: 1, customerId: 2, recipientName: 'Người nhận khác', recipientPhone: '0905555555', addressLine: 'Địa chỉ đã lưu', area: 'Quận 3', isDefault: true }])
  renderPage()
  fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Chọn địa chỉ đã lưu' }))
  // Địa chỉ mặc định đã được điền sẵn nên ô chọn cũng đang hiện nó; bấm đúng mục trong danh sách thả xuống.
  fireEvent.click((await screen.findAllByText('Mặc định · Người nhận khác · Địa chỉ đã lưu, Quận 3')).at(-1)!)
  expect((screen.getByLabelText('Tên người nhận') as HTMLInputElement).value).toBe('Người nhận khác')
  expect((screen.getByLabelText('Địa chỉ giao') as HTMLInputElement).value).toBe('Địa chỉ đã lưu')
  await placeOrder()
  await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ customer: 'Người nhận khác', phone: '0905555555', address: 'Địa chỉ đã lưu', area: 'Quận 3' })))
})

test('khách có sổ địa chỉ được điền sẵn địa chỉ mặc định và không bị mời lưu lại', async () => {
  mocks.user = { name: 'Customer', role: 'CUSTOMER', email: 'k@example.com', phone: '0901234567' }
  vi.mocked(customerAccountApi.addresses).mockResolvedValue([
    { id: 1, customerId: 2, recipientName: 'Nhà', recipientPhone: '0905555555', addressLine: 'Địa chỉ phụ', area: 'Quận 1', isDefault: false },
    { id: 2, customerId: 2, recipientName: 'Người nhận mặc định', recipientPhone: '0906666666', addressLine: 'Địa chỉ mặc định', area: 'Quận 3', isDefault: true },
  ])
  renderPage()
  await waitFor(() => expect((screen.getByLabelText('Địa chỉ giao') as HTMLInputElement).value).toBe('Địa chỉ mặc định'))
  expect((screen.getByLabelText('Tên người nhận') as HTMLInputElement).value).toBe('Người nhận mặc định')
  expect(screen.queryByLabelText('Lưu địa chỉ này vào sổ địa chỉ')).toBeNull()
  await placeOrder()
  await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ address: 'Địa chỉ mặc định', area: 'Quận 3' })))
  expect(customerAccountApi.createAddress).not.toHaveBeenCalled()
})

test('địa chỉ mới của khách được lưu vào sổ địa chỉ sau khi đặt đơn, bỏ tích thì không lưu', async () => {
  mocks.user = { name: 'Khách Tài Khoản', role: 'CUSTOMER', email: 'k@example.com', phone: '0901234567' }
  const first = renderPage()
  await fillDelivery()
  expect(((await screen.findByLabelText('Lưu địa chỉ này vào sổ địa chỉ')) as HTMLInputElement).checked).toBe(true)
  await placeOrder()
  await waitFor(() =>
    expect(customerAccountApi.createAddress).toHaveBeenCalledWith({
      recipientName: 'Khách Tài Khoản',
      recipientPhone: '0901234567',
      addressLine: '12 Đường Test',
      area: 'Phường Bến Thành',
      isDefault: true,
    }),
  )
  first.unmount()
  vi.mocked(customerAccountApi.createAddress).mockClear()
  mocks.mutateAsync.mockClear()

  renderPage()
  await fillDelivery()
  fireEvent.click(await screen.findByLabelText('Lưu địa chỉ này vào sổ địa chỉ'))
  await placeOrder()
  await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1))
  expect(customerAccountApi.createAddress).not.toHaveBeenCalled()
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

test('chọn khung giờ thì bắt buộc có ngày và khung, chưa chọn không tạo đơn; không còn ô chọn giờ phút', async () => {
  renderPage()
  type('Tên người nhận', 'Khách Thử')
  type('Số điện thoại', '0901234567')
  await fillDelivery()
  fireEvent.click(screen.getByLabelText('Chọn khung giờ'))
  expect(screen.getByText('Sáng 08:00–11:00')).toBeTruthy()
  expect(screen.getByText('Tối 17:00–20:00')).toBeTruthy()
  await placeOrder()
  expect(await screen.findByText('Chọn ngày nhận hàng.')).toBeTruthy()
  expect(await screen.findByText('Chọn khung giờ nhận hàng.')).toBeTruthy()
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
  expect(screen.getByLabelText('Trả khi nhận hàng')).toBeTruthy()
  expect((screen.getAllByRole('button', { name: /Đặt đơn/ })[0] as HTMLButtonElement).disabled).toBe(true)
})

test('đổi tầng tải phí mới và gửi tổng tiền đã báo khi đặt đơn', async () => {
  renderPage()
  await waitFor(() => expect(deliveryQuoteApi.quote).toHaveBeenCalledWith([{ productId: 1, quantity: 2 }], 0))
  vi.mocked(deliveryQuoteApi.quote).mockResolvedValue({ subtotal: 100000, baseFee: 15000, stairsFee: 16000, deliveryFee: 31000, total: 131000 })
  fireEvent.change(screen.getByLabelText('Số tầng đi thang bộ'), { target: { value: '3' } })
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

test('báo giá chưa có mức phí vẫn hiện cách tính chung, không để trống', async () => {
  vi.mocked(deliveryQuoteApi.quote).mockResolvedValue({ subtotal: 100000, baseFee: 15000, stairsFee: 0, deliveryFee: 15000, total: 115000 })
  renderPage()
  expect(await screen.findByText('Miễn phí khi đơn đủ số sản phẩm cửa hàng quy định')).toBeTruthy()
  expect(screen.getByText(/Tính cho mỗi bình\/thùng theo số tầng đi thang bộ/)).toBeTruthy()
})

test('khách vãng lai thấy lối đăng nhập quay lại trang đặt hàng; khách đã đăng nhập thì không', () => {
  const first = renderPage()
  expect(screen.getByRole('link', { name: 'Đăng nhập' }).getAttribute('href')).toBe('/shop/account')
  first.unmount()
  mocks.user = { name: 'Khách', role: 'CUSTOMER', email: 'k@example.com', phone: '0901234567' }
  renderPage()
  expect(screen.queryByRole('link', { name: 'Đăng nhập' })).toBeNull()
})

test('giao tới cổng, sảnh thì không hỏi số tầng, báo phí 0 tầng và ghi vào đầu ghi chú', async () => {
  renderPage()
  expect(screen.getByLabelText('Giao tận phòng')).toHaveProperty('checked', true)
  fireEvent.change(screen.getByLabelText('Số tầng đi thang bộ'), { target: { value: '3' } })
  await waitFor(() => expect(deliveryQuoteApi.quote).toHaveBeenLastCalledWith([{ productId: 1, quantity: 2 }], 3))
  fireEvent.click(screen.getByLabelText('Giao tới cổng, sảnh'))
  await waitFor(() => expect(screen.queryByLabelText('Số tầng đi thang bộ')).toBeNull())
  await waitFor(() => expect(deliveryQuoteApi.quote).toHaveBeenLastCalledWith([{ productId: 1, quantity: 2 }], 0))
  type('Tên người nhận', 'Khách Test')
  type('Số điện thoại', '0901234567')
  await fillDelivery()
  type('Ghi chú (không bắt buộc)', 'gọi trước')
  await placeOrder()
  await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1))
  expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({ floor: 0, note: 'Giao tới cổng/sảnh · gọi trước' })
})

test('chọn chuyển khoản trước thì báo mã QR hiện sau khi xác nhận và ghi vào ghi chú đơn', async () => {
  renderPage()
  fireEvent.click(screen.getByLabelText('Chuyển khoản trước'))
  expect(await screen.findByText(/trang theo dõi đơn sẽ hiện mã QR/)).toBeTruthy()
  type('Tên người nhận', 'Khách Test')
  type('Số điện thoại', '0901234567')
  await fillDelivery()
  await placeOrder()
  await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1))
  expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({ note: 'Giao tận phòng · Muốn chuyển khoản trước' })
})

test('cửa hàng chưa có số tài khoản thì chuyển khoản trước vẫn hiện nhưng khóa', () => {
  mocks.bank = undefined
  renderPage()
  expect(screen.getByLabelText('Chuyển khoản trước (chưa hỗ trợ)')).toHaveProperty('disabled', true)
  expect(screen.getByLabelText('Trả khi nhận hàng')).toHaveProperty('checked', true)
})

test('bình đổi vỏ thì hỏi có vỏ đổi hay cọc vỏ mới; chọn cọc thì ghi vào ghi chú đơn', async () => {
  mocks.bottleTypeId = 7
  renderPage()
  expect(screen.getByLabelText('Có vỏ đổi')).toHaveProperty('checked', true)
  expect(screen.getAllByText('Đổi vỏ cùng loại khi nhận hàng, không tính cọc.').length).toBeGreaterThan(0)
  fireEvent.click(screen.getByLabelText('Chưa có vỏ, cọc vỏ mới'))
  type('Tên người nhận', 'Khách Test')
  type('Số điện thoại', '0901234567')
  await fillDelivery()
  await placeOrder()
  await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1))
  expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({ note: 'Giao tận phòng · Chưa có vỏ, cọc vỏ mới' })
})

test('giỏ không có sản phẩm đổi vỏ thì không hỏi vỏ bình', () => {
  renderPage()
  expect(screen.queryByLabelText('Có vỏ đổi')).toBeNull()
})
