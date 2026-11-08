// @vitest-environment jsdom
import { beforeEach, afterEach, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ForgotPasswordPage, ResetPasswordPage } from './PasswordRecoveryPages'
import { passwordResetApi } from './passwordResetApi'
const logout = vi.fn()
vi.mock('./useAuth', () => ({ useAuth: () => ({ logout }) }))
vi.mock('./passwordResetApi', () => ({ passwordResetApi: { request: vi.fn(), reset: vi.fn() } }))
const token = 'a'.repeat(43)
beforeEach(() => {
  vi.resetAllMocks()
  Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })) })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/') })
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const showReset = () => render(<MemoryRouter initialEntries={[`/reset-password#token=${token}`]}><ResetPasswordPage /></MemoryRouter>)
test('requests recovery, prevents duplicate clicks and displays the generic acceptance message', async () => {
  let resolve!: (value: { message: string }) => void
  vi.mocked(passwordResetApi.request).mockImplementation(() => new Promise(done => { resolve = done }))
  render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>)
  type('Email đã đăng ký', 'customer@example.com')
  const send = screen.getByRole('button', { name: 'Gửi liên kết khôi phục' })
  fireEvent.click(send); fireEvent.click(send)
  await waitFor(() => expect(passwordResetApi.request).toHaveBeenCalledExactlyOnceWith('customer@example.com'))
  resolve({ message: 'Nếu email thuộc tài khoản đang hoạt động, bạn sẽ nhận được liên kết.' })
  expect(await screen.findByText('Đã tiếp nhận yêu cầu')).toBeTruthy()
  expect((screen.getByRole('button', { name: /Gửi lại sau/ }) as HTMLButtonElement).disabled).toBe(true)
})
test('shows mail-service errors without falsely claiming email was sent', async () => {
  vi.mocked(passwordResetApi.request).mockRejectedValue(new Error('Dịch vụ email chưa sẵn sàng'))
  render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>)
  type('Email đã đăng ký', 'customer@example.com')
  fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết khôi phục' }))
  expect(await screen.findByText('Dịch vụ email chưa sẵn sàng')).toBeTruthy()
  expect(screen.queryByText('Đã tiếp nhận yêu cầu')).toBeNull()
})
test('missing token gives a new-link action and cannot submit a password', () => {
  render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>)
  expect(screen.getByText('Liên kết khôi phục không hợp lệ')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Yêu cầu liên kết mới' }).getAttribute('href')).toBe('/forgot-password')
  expect(passwordResetApi.reset).not.toHaveBeenCalled()
})
test('validates confirmation then resets, clears old login and offers sign-in', async () => {
  vi.mocked(passwordResetApi.reset).mockResolvedValue(undefined)
  window.history.replaceState(null, '', `/reset-password#token=${token}`)
  showReset()
  expect(window.location.hash).toBe('')
  type('Mật khẩu mới', 'New-password-2026')
  type('Nhập lại mật khẩu mới', 'Wrong-password-2026')
  fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))
  expect(await screen.findByText('Hai mật khẩu chưa khớp.')).toBeTruthy()
  expect(passwordResetApi.reset).not.toHaveBeenCalled()
  type('Nhập lại mật khẩu mới', 'New-password-2026')
  fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))
  expect(await screen.findByText('Đã đặt mật khẩu mới')).toBeTruthy()
  expect(passwordResetApi.reset).toHaveBeenCalledExactlyOnceWith(token, 'New-password-2026')
  expect(logout).toHaveBeenCalledOnce()
})
test('expired links show API error without logging the user out', async () => {
  vi.mocked(passwordResetApi.reset).mockRejectedValue(new Error('Liên kết đã hết hạn'))
  showReset()
  type('Mật khẩu mới', 'New-password-2026'); type('Nhập lại mật khẩu mới', 'New-password-2026')
  fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))
  expect(await screen.findByText('Liên kết đã hết hạn')).toBeTruthy()
  expect(logout).not.toHaveBeenCalled()
})
