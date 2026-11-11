import type { TablePaginationConfig } from 'antd'

export const tablePagination: TablePaginationConfig = {
  defaultPageSize: 10,
  pageSizeOptions: [10, 20, 50],
  showSizeChanger: true,
  responsive: true,
  showTotal: (total, range) => `${range[0]}–${range[1]} / ${total} dòng`,
}

// Giới hạn vùng cuộn để tiêu đề và thanh phân trang luôn nằm ngoài danh sách.
export const tableScrollHeight = 'min(60vh, 640px)'

/** Danh mục (khách hàng, nhà cung cấp, sản phẩm) mặc định theo tên A→Z kiểu tiếng Việt; backend chưa trả theo thứ tự cố định. */
export const sortByName = <T extends { name: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }))
