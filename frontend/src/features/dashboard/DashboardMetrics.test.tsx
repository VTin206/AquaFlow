// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import dayjs from 'dayjs'
import { DashboardMetrics } from './DashboardMetrics'
import { reportApi, type LiveReport } from '@/features/reports/reportApi'

const auth = vi.hoisted(() => ({ role: 'ADMIN' }))
vi.mock('@/features/auth/useStaff', () => ({ useStaff: () => ({ role: auth.role }) }))
vi.mock('@/features/reports/reportApi', () => ({ reportApi: { summary: vi.fn(), section: vi.fn() } }))
vi.mock('@/shared/components/BarChart', () => ({ BarChart: () => <div>Biểu đồ doanh thu</div> }))
vi.mock('antd', async original => {
  const actual = await original<typeof import('antd')>()
  return { ...actual, DatePicker: { RangePicker: ({ onChange }: { onChange: (dates: ReturnType<typeof dayjs>[]) => void }) =>
    <><button onClick={() => onChange([dayjs('2026-01-01'), dayjs('2026-01-07')])}>Đổi kỳ</button>
      <button onClick={() => onChange([dayjs('2024-01-01'), dayjs('2026-01-07')])}>Kỳ quá dài</button></> } }
})
const report = { sales: { ordersCreated: 8, ordersDelivered: 5, ordersCancelled: 2, revenue: 150000, averageOrderValue: 30000, newCustomers: 3 },
  days: [{ date: '2026-01-01', revenue: 150000, collected: 0, orders: 8 }] } as LiveReport
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <MemoryRouter><DashboardMetrics /></MemoryRouter></QueryClientProvider>)
beforeEach(() => {
  auth.role = 'ADMIN'
  Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.mocked(reportApi.summary).mockReset().mockResolvedValue(report)
  vi.mocked(reportApi.section).mockReset().mockResolvedValue({ content: [{ key: '42', name: 'Khách A', orders: 5, revenue: 150000 }, { key: 'guest', name: 'Khách vãng lai', orders: 1, revenue: 10000 }], page: 0, size: 10, totalElements: 2 })
})
afterEach(cleanup)

test('hiển thị sáu KPI, biểu đồ và dẫn sang bảng khách của Báo cáo', async () => {
  mount()
  expect(await screen.findByText('AOV')).toBeTruthy()
  for (const title of ['Tổng đơn', 'Doanh thu', 'Đơn đã giao', 'Đơn đã hủy', 'Khách hàng mới']) expect(screen.getAllByText(title).length).toBeGreaterThan(0)
  expect(screen.getByRole('link', { name: 'Khách hàng mua nhiều' }).getAttribute('href')).toBe('/reports?tab=customers')
  expect(screen.getByText('Biểu đồ doanh thu')).toBeTruthy()
})
test('nhân viên không gọi API báo cáo hoặc thấy dữ liệu ADMIN', () => {
  auth.role = 'SALES_STAFF'
  mount()
  expect(reportApi.summary).not.toHaveBeenCalled()
  expect(reportApi.section).not.toHaveBeenCalled()
  expect(screen.queryByText('Kết quả kinh doanh')).toBeNull()
})
test('đang tải không hiển thị 0 hoặc báo dữ liệu rỗng', () => {
  vi.mocked(reportApi.summary).mockReturnValue(new Promise(() => {}))
  vi.mocked(reportApi.section).mockReturnValue(new Promise(() => {}))
  mount()
  expect(screen.queryByText('0')).toBeNull()
  expect(screen.queryByText('Chưa có dữ liệu kinh doanh trong kỳ.')).toBeNull()
})
test('kỳ rỗng hiện thông báo dù API vẫn trả bucket ngày bằng 0', async () => {
  vi.mocked(reportApi.summary).mockResolvedValue({ ...report, sales: { ...report.sales, ordersCreated: 0, ordersDelivered: 0, ordersCancelled: 0, revenue: 0, averageOrderValue: 0, newCustomers: 0 }, days: [{ date: '2026-01-01', revenue: 0, collected: 0, orders: 0 }] })
  mount()
  expect(await screen.findByText('Chưa có dữ liệu kinh doanh trong kỳ.')).toBeTruthy()
})
test('lỗi có thể thử lại và không hiển thị KPI bằng 0', async () => {
  vi.mocked(reportApi.summary).mockRejectedValueOnce(new Error('Không lấy được KPI'))
  mount()
  expect(await screen.findByText('Không lấy được KPI')).toBeTruthy()
  expect(screen.queryByText('AOV')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('AOV')).toBeTruthy()
})
test('đổi kỳ cập nhật API và không dùng lại KPI cũ khi đang tải', async () => {
  mount()
  await screen.findByText('AOV')
  vi.mocked(reportApi.summary).mockReturnValue(new Promise(() => {}))
  fireEvent.click(screen.getByText('Đổi kỳ'))
  await waitFor(() => expect(reportApi.summary).toHaveBeenLastCalledWith({ from: '2026-01-01', to: '2026-01-07' }))
  expect(screen.queryByText('AOV')).toBeNull()
  const calls = vi.mocked(reportApi.summary).mock.calls.length
  fireEvent.click(screen.getByText('Kỳ quá dài'))
  expect(screen.getByText('Chọn tối đa 366 ngày và không vượt quá hôm nay.')).toBeTruthy()
  expect(reportApi.summary).toHaveBeenCalledTimes(calls)
})
