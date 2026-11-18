// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import { articleApi, type PublicArticle } from '@/features/articles/articleApi'
import { ArticlePage } from './ArticlePage'

vi.mock('@/features/articles/articleApi', async (original) => ({
  ...(await original<typeof import('@/features/articles/articleApi')>()),
  articleApi: { published: vi.fn(), bySlug: vi.fn() },
}))

const news = (slug: string, title: string): PublicArticle => ({
  kind: 'NEWS',
  slug,
  title,
  summary: `Tóm tắt ${title}`,
  icon: 'recycle',
  publishedOn: '2026-10-14',
  body: null,
})

const clients: QueryClient[] = []
const show = (path: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/shop/news/:slug" element={<ArticlePage />} />
          <Route path="/shop/policy/:slug" element={<ArticlePage kind="policy" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.scrollTo = vi.fn()
  vi.mocked(articleApi.published).mockResolvedValue([news('coc-vo', 'Cọc vỏ'), news('bao-quan', 'Bảo quản'), news('dat-nuoc', 'Đặt nước')])
})
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
})

test('renders the article body from the API with headings and links to other articles', async () => {
  vi.mocked(articleApi.bySlug).mockResolvedValue({ ...news('coc-vo', 'Cọc vỏ'), body: 'Mở đầu\n## Hoàn cọc\nTrả vỏ nguyên vẹn.' })
  show('/shop/news/coc-vo')

  expect(await screen.findByRole('heading', { level: 1, name: 'Cọc vỏ' })).toBeTruthy()
  expect(screen.getByRole('heading', { level: 2, name: 'Hoàn cọc' })).toBeTruthy()
  expect(screen.getByText('Trả vỏ nguyên vẹn.')).toBeTruthy()
  expect(screen.getByText('14/10/2026')).toBeTruthy()
  expect(articleApi.bySlug).toHaveBeenCalledWith('coc-vo')
  // Bài đang xem không nằm trong "Bài viết khác".
  expect(await screen.findByRole('link', { name: 'Bảo quản' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Cọc vỏ' })).toBeNull()
})

test('shows not found for drafts and unknown slugs', async () => {
  vi.mocked(articleApi.bySlug).mockRejectedValue(new ApiError(404, 'Không tìm thấy bài viết.'))
  show('/shop/news/nhap')
  expect(await screen.findByText('Không tìm thấy bài viết.')).toBeTruthy()
  expect(screen.queryByText('Không tải được dữ liệu')).toBeNull()
})

test('does not open a news article under the policy address', async () => {
  vi.mocked(articleApi.bySlug).mockResolvedValue({ ...news('coc-vo', 'Cọc vỏ'), body: 'Nội dung' })
  show('/shop/policy/coc-vo')
  expect(await screen.findByText('Không tìm thấy bài viết.')).toBeTruthy()
})

test('offers retry when the article cannot be loaded', async () => {
  vi.mocked(articleApi.bySlug).mockRejectedValue(new ApiError(500, 'Máy chủ lỗi'))
  show('/shop/news/coc-vo')
  expect(await screen.findByText('Không tải được dữ liệu')).toBeTruthy()
  expect(screen.getByRole('button', { name: /Thử lại/ })).toBeTruthy()
})
