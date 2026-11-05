// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { RegisterForm } from './RegisterForm'
import { authService } from './authService'
vi.mock('./authService', () => ({ authService: { register: vi.fn() } }))
beforeEach(() => {
  vi.mocked(authService.register).mockReset()
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi
      .fn()
      .mockImplementation(() => ({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
  })
  const style = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((e) => style(e))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
function fill(confirm = 'Customer123') {
  render(
    <MemoryRouter>
      <RegisterForm />
    </MemoryRouter>,
  )
  for (const [label, value] of [
    ['Họ và tên', 'Khách Test'],
    ['Số điện thoại', '0901234567'],
    ['Email', 'test@example.com'],
    ['Mật khẩu', 'Customer123'],
    ['Nhập lại mật khẩu', confirm],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
}
it('registers and offers login without submitting twice', async () => {
  vi.mocked(authService.register).mockResolvedValue({
    id: 1,
    fullName: 'Khách Test',
    email: 'test@example.com',
    phone: '0901234567',
    role: 'CUSTOMER',
    status: 'ACTIVE',
  })
  fill()
  expect(await screen.findByText('Tạo tài khoản thành công')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Đăng nhập' }).getAttribute('href')).toBe('/shop/account')
  expect(authService.register).toHaveBeenCalledTimes(1)
})
it('keeps the form available after registration fails', async () => {
  vi.mocked(authService.register).mockRejectedValue(new Error('Email đã được sử dụng'))
  fill()
  expect(await screen.findByText('Email đã được sử dụng')).toBeTruthy()
  await waitFor(() => expect((screen.getByRole('button', { name: 'Tạo tài khoản' }) as HTMLButtonElement).disabled).toBe(false))
})
it('does not call the API when passwords do not match', async () => {
  fill('different-password')
  expect(await screen.findByText('Mật khẩu nhập lại không khớp.')).toBeTruthy()
  expect(authService.register).not.toHaveBeenCalled()
})
