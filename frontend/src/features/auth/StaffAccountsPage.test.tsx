// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { StaffAccountsPage } from './StaffAccountsPage'
import { staffApi, type StaffAccount } from './staffApi'

vi.mock('./useAuth', () => ({ useAuth: () => ({ user: { email: 'admin@test' } }) }))
vi.mock('./staffApi', () => ({ staffApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), password: vi.fn() } }))

const accounts: StaffAccount[] = [
  { id: 1, fullName: 'Nguyễn Bán', email: 'ban@test', phone: '0901111111', role: 'SALES_STAFF', status: 'ACTIVE' },
  { id: 2, fullName: 'Trần Giao', email: 'giao@test', phone: '0902222222', role: 'DELIVERY_STAFF', status: 'ACTIVE' },
  { id: 3, fullName: 'Lê Nghỉ', email: 'nghi@test', phone: null, role: 'DELIVERY_STAFF', status: 'INACTIVE' },
]

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })),
  })
  vi.mocked(staffApi.list).mockResolvedValue(accounts)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('lọc nhân viên theo vai trò, trạng thái và tìm theo tên/số điện thoại', async () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <App>
          <StaffAccountsPage />
        </App>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  expect(await screen.findByText('Nguyễn Bán')).toBeTruthy()
  fireEvent.click(screen.getByText('Giao hàng'))
  await waitFor(() => expect(screen.queryByText('Nguyễn Bán')).toBeNull())
  expect(screen.getByText('Trần Giao')).toBeTruthy()
  expect(screen.getByText('Lê Nghỉ')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Tìm nhân viên'), { target: { value: '0902' } })
  await waitFor(() => expect(screen.queryByText('Lê Nghỉ')).toBeNull())
  expect(screen.getByText('Trần Giao')).toBeTruthy()
})
