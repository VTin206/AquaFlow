import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import type { TablePaginationConfig } from 'antd'

/** Danh sách đã được BE phân trang: bảng chỉ hiện trang hiện tại và báo đổi trang ra ngoài. `page` tính từ 0. */
export type ServerPagination = { page: number; size: number; total: number; onChange: (page: number, size: number) => void }

/** Cấu hình AntD Table cho danh sách BE phân trang. */
export const serverTablePagination = ({ page, size, total, onChange }: ServerPagination): TablePaginationConfig => ({
  ...tablePagination,
  current: page + 1,
  pageSize: size,
  total,
  onChange: (next, nextSize) => onChange(nextSize !== size ? 0 : next - 1, nextSize),
})

export const tablePagination: TablePaginationConfig = {
  // Số dòng cố định, không cho chọn: bảng hiện đủ dòng của trang và cả trang cuộn, không cuộn lồng trong bảng.
  defaultPageSize: 10,
  showSizeChanger: false,
  responsive: true,
  showTotal: (total, range) => `${range[0]}–${range[1]} / ${total} dòng`,
}

/**
 * Số dòng mỗi trang vừa khít màn hình: bảng và thanh phân trang nằm gọn trong một khung hình, chuyển trang không phải
 * cuộn. Đo khoảng trống từ dòng đầu của bảng tới đáy màn hình (trừ phần phân trang và lề dưới trang) chia cho chiều cao
 * một dòng; đổi cỡ cửa sổ thì tính lại. Gắn `attach` vào `ref` của phần tử bọc bảng.
 */
export function useFitPageSize(min = 10) {
  const [root, attach] = useState<HTMLElement | null>(null)
  const [viewport, setViewport] = useState(() => window.innerHeight)
  // Chiều cao dòng chốt theo lần đo đầu; đo lại mỗi trang dễ làm số dòng nhảy qua lại khi các trang cao thấp khác nhau.
  const [rowHeight, setRowHeight] = useState<number>()
  const [pageSize, setPageSize] = useState(tablePagination.defaultPageSize ?? 10)
  useEffect(() => {
    const onResize = () => setViewport(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const measure = useCallback(() => {
    const body = root?.querySelector<HTMLElement>('.ant-table-tbody')
    const page = root?.closest<HTMLElement>('.af-page')
    if (!body || !page) return
    const row = body.querySelector<HTMLElement>('tr.ant-table-row')
    const height = rowHeight ?? row?.offsetHeight
    if (rowHeight === undefined && row) setRowHeight(row.offsetHeight)
    if (!height) return
    const rows = body.querySelectorAll('tr.ant-table-row').length
    const bodyBox = body.getBoundingClientRect()
    // Phần dưới các dòng: thanh phân trang, lề khung và lề dưới trang.
    const contentEnd = page.parentElement ? parseFloat(getComputedStyle(page.parentElement).paddingBottom) || 0 : 0
    const below = page.getBoundingClientRect().bottom - bodyBox.bottom + contentEnd
    const top = bodyBox.top + window.scrollY
    // Bảng có ít dòng hơn sức chứa thì phần dưới vẫn có chỗ cho thanh phân trang.
    const pagerRoom = rows ? 0 : 56
    setPageSize(Math.max(min, Math.floor((viewport - top - below - pagerRoom) / height)))
  }, [root, rowHeight, viewport, min])
  // Đo khi bảng hoặc trang đổi cỡ (tải xong dữ liệu, hiện thêm cảnh báo phía trên…); lần quan sát đầu đo ngay.
  useLayoutEffect(() => {
    if (!root) return
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [root, measure])
  return { attach, pageSize }
}

/**
 * Bảng trong cửa sổ quản lý danh mục (loại sản phẩm, loại vỏ): chừa chỗ cho tiêu đề cửa sổ, thanh công cụ,
 * tiêu đề cột, phân trang và nút Đóng để cửa sổ không cao quá màn hình; màn hình đủ cao thì không cuộn.
 */
export const modalTableScrollHeight = 'max(200px, calc(100dvh - 340px))'

/** Danh mục (khách hàng, nhà cung cấp, sản phẩm) mặc định theo tên A→Z kiểu tiếng Việt; backend chưa trả theo thứ tự cố định. */
export const sortByName = <T extends { name: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }))
