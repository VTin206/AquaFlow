// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CustomerAccountPanel } from './CustomerAccountPanel'
import { customerAccountApi, type SavedAddress } from './customerAccountApi'

const updateProfile = vi.fn()
vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => ({ user: { name: 'Khách', email: 'khach@test.com', role: 'CUSTOMER' }, updateProfile }) }))
vi.mock('./customerAccountApi', async original => ({
  ...(await original<typeof import('./customerAccountApi')>()),
  customerAccountApi: { profile: vi.fn(), updateProfile: vi.fn(), addresses: vi.fn(), createAddress: vi.fn(), updateAddress: vi.fn(), deleteAddress: vi.fn() },
}))
const profile = { fullName: 'Khách', email: 'khach@test.com', phone: '0901234567' }
const address: SavedAddress = { id: 1, customerId: 2, recipientName: 'Người nhận', recipientPhone: '0901234567', addressLine: '12 Đường A', area: 'Phường Bến Thành', isDefault: true }
/** Chọn phường/xã trong ô chọn: gõ không dấu để lọc rồi bấm đúng mục. */
const pickWard = async (search: string, ward: string) => {
  const box = screen.getByLabelText('Phường/Xã')
  fireEvent.mouseDown(box)
  fireEvent.change(box, { target: { value: search } })
  fireEvent.click(await screen.findByTitle(ward))
}

const clients: QueryClient[] = []
const show = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  return render(<QueryClientProvider client={client}><App><CustomerAccountPanel /></App></QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(customerAccountApi.profile).mockResolvedValue(profile)
  vi.mocked(customerAccountApi.addresses).mockResolvedValue([])
  vi.mocked(customerAccountApi.updateProfile).mockReset()
  vi.mocked(customerAccountApi.createAddress).mockReset()
  vi.mocked(customerAccountApi.updateAddress).mockReset()
  Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })) })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  const getStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation(element => getStyle(element))
})
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks(); vi.unstubAllGlobals() })

test('saves profile and synchronizes the signed-in user only after API success', async () => {
  const changed = { ...profile, fullName: 'Tên mới' }
  vi.mocked(customerAccountApi.updateProfile).mockResolvedValue(changed)
  show()
  fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: ' Tên mới ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
  await waitFor(() => expect(customerAccountApi.updateProfile).toHaveBeenCalledWith({ fullName: 'Tên mới', phone: '0901234567' }, expect.anything()))
  expect(updateProfile).toHaveBeenCalledWith(changed)
})

test('keeps profile edits visible on conflict and does not alter the signed-in user', async () => {
  vi.mocked(customerAccountApi.updateProfile).mockRejectedValue(new Error('Số điện thoại đã thuộc khách hàng khác'))
  show()
  fireEvent.change(await screen.findByLabelText('Số điện thoại'), { target: { value: '0902222222' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
  expect(await screen.findByText('Số điện thoại đã thuộc khách hàng khác')).toBeTruthy()
  expect((screen.getByLabelText('Số điện thoại') as HTMLInputElement).value).toBe('0902222222')
  expect(updateProfile).not.toHaveBeenCalled()
})

test('adds an address from the empty state and refreshes the list', async () => {
  show()
  await screen.findByText('Bạn chưa lưu địa chỉ nào.')
  fireEvent.click(screen.getByRole('button', { name: 'Thêm địa chỉ' }))
  fireEvent.change(screen.getByLabelText('Tên người nhận'), { target: { value: address.recipientName } })
  fireEvent.change(screen.getByLabelText('Địa chỉ'), { target: { value: address.addressLine } })
  await pickWard('ben thanh', address.area)
  vi.mocked(customerAccountApi.createAddress).mockResolvedValue(address)
  vi.mocked(customerAccountApi.addresses).mockResolvedValue([address])
  fireEvent.click(screen.getByRole('button', { name: 'Lưu địa chỉ' }))
  expect(await screen.findByText('12 Đường A, Phường Bến Thành')).toBeTruthy()
  expect(customerAccountApi.createAddress).toHaveBeenCalledWith({ recipientName: address.recipientName, recipientPhone: address.recipientPhone, addressLine: address.addressLine, area: address.area, isDefault: true })
})

test('keeps address edits after API failure and allows retry', async () => {
  vi.mocked(customerAccountApi.addresses).mockResolvedValue([address])
  vi.mocked(customerAccountApi.updateAddress).mockRejectedValue(new Error('Mất kết nối'))
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }))
  fireEvent.change(screen.getByLabelText('Địa chỉ'), { target: { value: '99 Đường mới' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu địa chỉ' }))
  expect(await screen.findByText('Mất kết nối')).toBeTruthy()
  expect((screen.getByLabelText('Địa chỉ') as HTMLInputElement).value).toBe('99 Đường mới')
  expect(customerAccountApi.updateAddress).toHaveBeenCalledWith(1, expect.objectContaining({ addressLine: '99 Đường mới' }))
})

test('sets the default address and requires confirmation before deleting', async () => {
  vi.mocked(customerAccountApi.addresses).mockResolvedValue([{ ...address, isDefault: false }])
  vi.mocked(customerAccountApi.updateAddress).mockResolvedValue(address)
  vi.mocked(customerAccountApi.deleteAddress).mockResolvedValue(undefined)
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Đặt mặc định' }))
  await waitFor(() => expect(customerAccountApi.updateAddress).toHaveBeenCalledWith(1, expect.objectContaining({ isDefault: true })))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Xóa' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Xóa' }))
  expect(customerAccountApi.deleteAddress).not.toHaveBeenCalled()
  vi.mocked(customerAccountApi.addresses).mockResolvedValue([])
  const buttons = await screen.findAllByRole('button', { name: 'Xóa' })
  fireEvent.click(buttons[buttons.length - 1])
  expect(await screen.findByText('Bạn chưa lưu địa chỉ nào.')).toBeTruthy()
  expect(customerAccountApi.deleteAddress).toHaveBeenCalledWith(1, expect.anything())
})
