// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { articleApi, type Article } from './articleApi'
import { ArticlesPage } from './ArticlesPage'

vi.mock('./articleApi', async (original) => ({
  ...(await original<typeof import('./articleApi')>()),
  articleApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))

const article = (patch: Partial<Article>): Article => ({
  id: 1,
  kind: 'NEWS',
  slug: 'coc-vo',
  title: 'Cọc vỏ bình',
  summary: 'Cách tính cọc',
  icon: 'recycle',
  body: 'Nội dung',
  published: true,
  publishedOn: '2026-10-14',
  createdAt: '2026-10-14T01:00:00Z',
  updatedAt: '2026-10-14T01:00:00Z',
  version: 4,
  ...patch,
})
const news = article({})
const policy = article({ id: 2, kind: 'POLICY', slug: 'doi-tra', title: 'Chính sách đổi trả', icon: 'rotate-ccw', publishedOn: null })
const draft = article({ id: 3, slug: 'nhap', title: 'Tin nháp', published: false, publishedOn: null })

const clients: QueryClient[] = []
const show = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/articles']}>
        <App>
          <ArticlesPage />
        </App>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const dialog = () => screen.getByRole('dialog')

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(articleApi.list).mockResolvedValue([news, policy, draft])
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  const getStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => getStyle(element))
})
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('lists drafts and published articles and filters by kind', async () => {
  show()
  expect(await screen.findByText('Tin nháp')).toBeTruthy()
  expect(screen.getByText('Bản nháp')).toBeTruthy()
  expect(screen.getAllByText('Đã đăng')).toHaveLength(2)
  // Bản nháp chưa có link trên trang khách.
  expect(screen.getByRole('link', { name: 'Xem Cọc vỏ bình trên trang khách' }).getAttribute('href')).toBe('/shop/news/coc-vo')
  expect(screen.getByRole('link', { name: 'Xem Chính sách đổi trả trên trang khách' }).getAttribute('href')).toBe('/shop/policy/doi-tra')

  fireEvent.click(screen.getByText('Chính sách', { selector: '.ant-segmented-item-label' }))
  expect(screen.queryByText('Tin nháp')).toBeNull()
  expect(screen.getByText('Chính sách đổi trả')).toBeTruthy()
})

test('creates a draft news article and lets the backend generate the slug', async () => {
  vi.mocked(articleApi.create).mockResolvedValue(article({ id: 9, title: 'Khuyến mãi', published: false }))
  show()
  fireEvent.click(await screen.findByRole('button', { name: /Thêm bài viết/ }))
  fireEvent.change(within(dialog()).getByLabelText('Tiêu đề'), { target: { value: 'Khuyến mãi' } })
  fireEvent.change(within(dialog()).getByLabelText('Tóm tắt'), { target: { value: 'Giảm giá bình 19L' } })
  fireEvent.change(within(dialog()).getByLabelText('Nội dung'), { target: { value: 'Đoạn 1\n## Điều kiện' } })
  fireEvent.click(within(dialog()).getByRole('button', { name: 'Lưu' }))

  await waitFor(() =>
    expect(articleApi.create).toHaveBeenCalledWith({
      kind: 'NEWS',
      slug: '',
      title: 'Khuyến mãi',
      summary: 'Giảm giá bình 19L',
      icon: 'newspaper',
      body: 'Đoạn 1\n## Điều kiện',
      published: false,
      publishedOn: null,
      version: undefined,
    }),
  )
  expect(await screen.findByText('Đã lưu bản nháp.')).toBeTruthy()
})

test('editing sends the version that was read and keeps the article kind', async () => {
  vi.mocked(articleApi.update).mockResolvedValue(article({ title: 'Cọc vỏ bình mới', version: 5 }))
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa Cọc vỏ bình' }))
  fireEvent.change(within(dialog()).getByLabelText('Tiêu đề'), { target: { value: 'Cọc vỏ bình mới' } })
  fireEvent.click(within(dialog()).getByRole('button', { name: 'Lưu' }))

  await waitFor(() => expect(articleApi.update).toHaveBeenCalled())
  const [id, input] = vi.mocked(articleApi.update).mock.calls[0]
  expect(id).toBe(1)
  expect(input).toMatchObject({
    kind: 'NEWS',
    slug: 'coc-vo',
    title: 'Cọc vỏ bình mới',
    published: true,
    publishedOn: '2026-10-14',
    version: 4,
  })
})

test('shows the conflict message and reloads the list when someone else saved first', async () => {
  vi.mocked(articleApi.update).mockRejectedValue(new Error('Bài viết vừa được người khác sửa. Tải lại để xem bản mới rồi sửa lại.'))
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa Cọc vỏ bình' }))
  fireEvent.click(within(dialog()).getByRole('button', { name: 'Lưu' }))

  expect(await screen.findByText(/vừa được người khác sửa/)).toBeTruthy()
  await waitFor(() => expect(articleApi.list).toHaveBeenCalledTimes(2))
  // Form vẫn mở để người dùng không mất phần đã sửa.
  expect(dialog()).toBeTruthy()
})

test('asks before deleting and deletes only after confirmation', async () => {
  vi.mocked(articleApi.remove).mockResolvedValue(undefined)
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Xóa Tin nháp' }))
  expect((await screen.findAllByText('Xóa bài "Tin nháp"?')).length).toBeGreaterThan(0)
  expect(articleApi.remove).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Xóa bài' }))
  await waitFor(() => expect(articleApi.remove).toHaveBeenCalledWith(3))
  expect(await screen.findByText('Đã xóa bài viết.')).toBeTruthy()
})
