import { matchesSearch } from '@/shared/utils/search'

/** Một trang kết quả từ BE (`PageResponse`), trang bắt đầu từ 0. */
export type Page<T> = { items: T[]; page: number; size: number; total: number; totalPages: number }

/** Tham số trang và từ khóa (tìm không dấu, theo tên hoặc số điện thoại) gửi lên BE. */
export type PageQuery = { page: number; size: number; q?: string }

/** Bỏ tham số rỗng để URL gọn và khóa cache ổn định. */
export const pageParams = ({ page, size, q }: PageQuery) => ({ page, size, ...(q?.trim() ? { q: q.trim() } : {}) })

/** Bản dùng thử: lọc và cắt trang tại chỗ cho cùng dạng với BE. */
export function pageLocally<T>(rows: T[], { page, size, q }: PageQuery, text: (row: T) => string, phone?: (row: T) => string): Page<T> {
  const matched = q?.trim() ? rows.filter((row) => matchesSearch(q, text(row), phone?.(row))) : rows
  return {
    items: matched.slice(page * size, page * size + size),
    page,
    size,
    total: matched.length,
    totalPages: Math.ceil(matched.length / size),
  }
}
