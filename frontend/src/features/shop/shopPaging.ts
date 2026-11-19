/** Mục Sản phẩm chia trang cố định, mỗi trang 24 sản phẩm. */
export const SHOP_PAGE_SIZE = 24

/** Cắt đúng trang đang xem; số trang vượt quá (do lọc bớt) thì lùi về trang cuối. */
export function shopPage<T>(items: readonly T[], pageParam: string | null) {
  const pages = Math.max(1, Math.ceil(items.length / SHOP_PAGE_SIZE))
  const requested = Number.parseInt(pageParam ?? '', 10)
  const page = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), pages) : 1
  return { page, items: items.slice((page - 1) * SHOP_PAGE_SIZE, page * SHOP_PAGE_SIZE) }
}
