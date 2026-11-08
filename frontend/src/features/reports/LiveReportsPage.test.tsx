// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { App } from 'antd'
import dayjs from 'dayjs'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LiveReportsPage } from './LiveReportsPage'
import { reportApi, type LiveReport } from './reportApi'
const auth = vi.hoisted(() => ({ role: 'ADMIN' }))
vi.mock('@/features/auth/useStaff', () => ({ useStaff: () => ({ role: auth.role }) }))
vi.mock('./reportApi', async original => ({ ...(await original<typeof import('./reportApi')>()), reportApi: { summary: vi.fn(), section: vi.fn() } }))
vi.mock('./charts', () => ({ RevenueChart: () => null }))
vi.mock('antd', async original => {
  const actual = await original<typeof import('antd')>()
  return { ...actual, DatePicker: { RangePicker: ({ onChange }: { onChange: (dates: ReturnType<typeof dayjs>[]) => void }) => <>
    <button onClick={() => onChange([dayjs('2026-01-01'), dayjs('2026-01-07')])}>Đổi kỳ test</button>
    <button onClick={() => onChange([dayjs('2024-01-01'), dayjs('2026-01-07')])}>Kỳ quá dài</button>
  </> } }
})
const report = { generatedAt: '2026-01-02T00:00:00Z', sales: { revenue: 0, netPayments: 0, ordersDelivered: 0, ordersCreated: 0, ordersCancelled: 0 }, days: [], channels: [], deposits: {}, receipts: {} } as unknown as LiveReport
const mount = (tab = 'delivery') => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <MemoryRouter initialEntries={[`/reports?tab=${tab}`]}><App><LiveReportsPage /></App></MemoryRouter>
</QueryClientProvider>)
beforeEach(() => {
  auth.role = 'ADMIN'
  Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.mocked(reportApi.summary).mockReset().mockResolvedValue(report)
  vi.mocked(reportApi.section).mockReset().mockResolvedValue({ content: [{ driverId: 1, driver: 'Tài xế Test', delivered: 5, failed: 2, redelivered: 3, late: 1 }], page: 0, size: 20, totalElements: 1 })
})
afterEach(cleanup)
test('giao hàng hiển thị giao lại và đổi kỳ gửi đúng filter đến API', async () => {
  mount()
  expect(await screen.findByText('Tài xế Test')).toBeTruthy()
  expect(screen.getAllByText('Lần giao lại').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Giao trễ hẹn').length).toBeGreaterThan(0)
  fireEvent.click(screen.getByText('Đổi kỳ test'))
  await waitFor(() => expect(reportApi.section).toHaveBeenLastCalledWith('delivery', expect.objectContaining({ from: '2026-01-01', to: '2026-01-07' }), 0, 20))
  const calls = vi.mocked(reportApi.section).mock.calls.length
  fireEvent.click(screen.getByText('Kỳ quá dài'))
  expect(screen.getByText('Chọn tối đa 366 ngày và không vượt quá hôm nay.')).toBeTruthy()
  expect(reportApi.section).toHaveBeenCalledTimes(calls)
})
test('tồn kho hiển thị giá trị và phân biệt thiếu giá nhập với giá bằng 0', async () => {
  vi.mocked(reportApi.section).mockResolvedValue({ content: [
    { productId: 1, name: 'Hàng chưa có giá', closing: 10, latestUnitCost: null, closingValue: null },
    { productId: 2, name: 'Hàng có giá', closing: 20, latestUnitCost: 12, closingValue: 240 },
  ], page: 0, size: 20, totalElements: 2 })
  mount('inventory')
  expect(await screen.findByText('Hàng có giá')).toBeTruthy()
  expect(screen.getAllByText('Chưa có giá nhập')).toHaveLength(2)
  expect(screen.getAllByText('Giá trị tồn cuối kỳ').length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: /Chỉnh kho/ })).toBeNull()
})
test.each(['inventory', 'delivery'])('%s xử lý loading, lỗi, thử lại và kỳ rỗng', async tab => {
  let reject!: (error: Error) => void
  vi.mocked(reportApi.section).mockReturnValueOnce(new Promise((_, fail) => { reject = fail }))
  mount(tab)
  expect(await screen.findByText('Đang tải báo cáo…')).toBeTruthy()
  expect(screen.queryByText('Chưa có dữ liệu trong kỳ.')).toBeNull()
  reject(new Error('Lỗi báo cáo test'))
  expect(await screen.findByText('Lỗi báo cáo test')).toBeTruthy()
  vi.mocked(reportApi.section).mockResolvedValue({ content: [], page: 0, size: 20, totalElements: 0 })
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Chưa có dữ liệu trong kỳ.')).toBeTruthy()
})
test.each(['SALES_STAFF', 'DELIVERY_STAFF'])('%s không gọi API báo cáo ADMIN', role => {
  auth.role = role
  mount()
  expect(screen.getByText('Chỉ ADMIN được xem báo cáo.')).toBeTruthy()
  expect(reportApi.summary).not.toHaveBeenCalled()
  expect(reportApi.section).not.toHaveBeenCalled()
})
