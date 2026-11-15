import { useState } from 'react'
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
  defaultPageSize: 10,
  pageSizeOptions: [10, 20, 50],
  showSizeChanger: true,
  responsive: true,
  showTotal: (total, range) => `${range[0]}–${range[1]} / ${total} dòng`,
}

// Giới hạn vùng cuộn để tiêu đề và thanh phân trang luôn nằm ngoài danh sách.
export const tableScrollHeight = 'min(60vh, 640px)'

/**
 * Mức số dòng nhỏ nhất hiện đủ cả trang, chỉ cuộn trang như bình thường; chọn nhiều dòng hơn (20, 50…) thì danh sách
 * cuộn bên trong để tiêu đề cột và thanh phân trang luôn thấy.
 */
export const pagedScroll = (pageSize: number, smallest = tablePagination.defaultPageSize ?? 10) =>
  pageSize > smallest ? { y: tableScrollHeight } : {}

/** Phân trang phía FE kèm cuộn theo số dòng đã chọn (xem `pagedScroll`). */
export function usePagedTable() {
  const [pageSize, setPageSize] = useState(tablePagination.defaultPageSize ?? 10)
  const pagination: TablePaginationConfig = { ...tablePagination, pageSize, onShowSizeChange: (_, size) => setPageSize(size) }
  return { pagination, scroll: pagedScroll(pageSize) }
}

/**
 * Bảng trong cửa sổ quản lý danh mục (loại sản phẩm, loại vỏ): chừa chỗ cho tiêu đề cửa sổ, thanh công cụ,
 * tiêu đề cột, phân trang và nút Đóng để cửa sổ không cao quá màn hình; màn hình đủ cao thì không cuộn.
 */
export const modalTableScrollHeight = 'max(200px, calc(100dvh - 340px))'

/** Danh mục (khách hàng, nhà cung cấp, sản phẩm) mặc định theo tên A→Z kiểu tiếng Việt; backend chưa trả theo thứ tự cố định. */
export const sortByName = <T extends { name: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }))
