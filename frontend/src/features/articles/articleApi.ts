import { api } from '@/shared/api/client'

/** NEWS: tin tức trên trang chủ khách. POLICY: trang chính sách ở chân trang. */
export type ArticleKind = 'NEWS' | 'POLICY'

/** Bài đã đăng cho trang khách. `body` chỉ có khi xem một bài, danh sách trả null. */
export type PublicArticle = {
  kind: ArticleKind
  slug: string
  title: string
  summary: string
  icon: string
  /** "yyyy-mm-dd"; chính sách không ghi ngày. */
  publishedOn: string | null
  body: string | null
}

/** Bài viết đầy đủ cho chủ cửa hàng, gồm cả bản nháp. */
export type Article = Omit<PublicArticle, 'body'> & {
  id: number
  body: string
  published: boolean
  createdAt: string
  updatedAt: string
  /** Gửi lại khi sửa; người khác đã sửa trước thì BE trả 409. */
  version: number
}

export type ArticleInput = {
  /** Chỉ dùng khi thêm; BE không đổi loại bài đã có. */
  kind?: ArticleKind
  /** Để trống thì BE tự sinh từ tiêu đề. */
  slug?: string
  title: string
  summary: string
  icon: string
  body: string
  published: boolean
  publishedOn?: string | null
  version?: number
}

export const articleApi = {
  published: (kind: ArticleKind) => api.get<PublicArticle[]>(`/shop-articles?kind=${kind}`),
  bySlug: (slug: string) => api.get<PublicArticle>(`/shop-articles/${encodeURIComponent(slug)}`),
  list: () => api.get<Article[]>('/admin/shop-articles'),
  create: (input: ArticleInput) => api.post<Article>('/admin/shop-articles', input),
  update: (id: number, input: ArticleInput) => api.put<Article>(`/admin/shop-articles/${id}`, input),
  remove: (id: number) => api.delete<void>(`/admin/shop-articles/${id}`),
}

/** Khóa chung với màn hình quản lý: lưu bài thì làm mới cả trang khách đang mở. */
export const articleKeys = {
  all: ['live', 'shop-articles'] as const,
  published: (kind: ArticleKind) => ['live', 'shop-articles', 'published', kind] as const,
  bySlug: (slug: string) => ['live', 'shop-articles', 'slug', slug] as const,
  admin: ['live', 'shop-articles', 'admin'] as const,
}

/** Đoạn văn của bài: mỗi dòng một đoạn, dòng bắt đầu bằng "## " là tiêu đề nhỏ. Dòng trống bị bỏ qua. */
export type ArticleBlock = { kind: 'heading' | 'paragraph'; text: string }

export const articleBlocks = (body: string): ArticleBlock[] =>
  body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith('## ') ? { kind: 'heading', text: line.slice(3).trim() } : { kind: 'paragraph', text: line }))

export const articleDate = (isoDate: string) => new Date(`${isoDate}T00:00:00`).toLocaleDateString('vi-VN')
