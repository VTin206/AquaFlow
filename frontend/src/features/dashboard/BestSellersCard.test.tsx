// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { reportApi, type ReportRow } from '@/features/reports/reportApi'
import { BestSellersCard } from './BestSellersCard'

vi.mock('@/features/reports/reportApi', async (original) => ({
  ...(await original<typeof import('@/features/reports/reportApi')>()),
  reportApi: { summary: vi.fn(), section: vi.fn() },
}))

const row = (productId: string, name: string, sold: number, returned: number, revenue: number): ReportRow => ({
  productId,
  sku: productId,
  name,
  unit: 'bình',
  sold,
  returned,
  revenue,
})

const clients: QueryClient[] = []
const show = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BestSellersCard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // Recharts đo kích thước khung bằng ResizeObserver, jsdom không có.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
})

test('ranks the last 30 days by quantity net of returns and links to the product report', async () => {
  vi.mocked(reportApi.section).mockResolvedValue({
    content: [row('1', 'Nước khoáng thùng 24 chai', 10, 0, 3_000_000), row('2', 'Bình 19L', 32, 2, 1_500_000)],
    page: 0,
    size: 100,
    totalElements: 2,
  })
  show()

  const first = (await screen.findByText('Bình 19L')).closest('li')
  const items = [...(first?.parentElement?.children ?? [])]
  // Bình 19L doanh thu thấp hơn nhưng bán nhiều hơn (30 sau khi trừ 2 trả lại) nên đứng đầu.
  expect(items[0].textContent).toContain('Bình 19L')
  expect(items[0].textContent).toContain('75%')
  expect(items[1].textContent).toContain('25%')
  expect(reportApi.section).toHaveBeenCalledWith('products', expect.objectContaining({ from: expect.any(String) }), 0, 100)
  const link = screen.getByRole('link', { name: /Xem chi tiết/ })
  expect(link.getAttribute('href')).toMatch(/^\/reports\?tab=products&from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/)
})

test('shows an empty state when nothing was sold', async () => {
  vi.mocked(reportApi.section).mockResolvedValue({ content: [], page: 0, size: 100, totalElements: 0 })
  show()
  expect(await screen.findByText('Chưa bán sản phẩm nào 30 ngày qua.')).toBeTruthy()
})
