import { useState, type ReactNode } from 'react'
import { fontSizes } from '@/app/typography'
import { Card, ConfigProvider, Empty, Pagination, Skeleton } from 'antd'
import type { ServerPagination } from '@/shared/utils/table'

type MobileRecordListProps<T> = {
  items: T[]
  rowKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  loading?: boolean
  emptyText: string
  label: string
  paginate?: boolean
  controls?: ReactNode
  /** BE đã phân trang: `items` là trang hiện tại, tổng số và đổi trang lấy từ đây. */
  server?: ServerPagination
}

/** Danh sách thẻ có loading/empty/phân trang, dùng cho màn hình nhỏ. */
export function MobileRecordList<T>({
  items,
  rowKey,
  renderItem,
  loading,
  emptyText,
  label,
  paginate = true,
  controls,
  server,
}: MobileRecordListProps<T>) {
  const [localPage, setLocalPage] = useState(1)
  const pageSize = server?.size ?? 10
  const total = server?.total ?? items.length
  // Dữ liệu có thể giảm sau khi lọc hoặc cập nhật; không để trang hiện tại trống giả.
  const current = server ? server.page + 1 : Math.min(localPage, Math.max(1, Math.ceil(total / pageSize)))
  const setPage = (next: number) => (server ? server.onChange(next - 1, server.size) : setLocalPage(next))
  const visible = paginate && !server ? items.slice((current - 1) * pageSize, current * pageSize) : items

  return (
    <ConfigProvider theme={{ token: { controlHeight: 44, fontSizeSM: fontSizes.sm } }}>
      <section className="af-mobile-records" aria-label={label} aria-busy={Boolean(loading)}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : items.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
        ) : (
          <>
            {controls && <div className="af-mobile-record-controls">{controls}</div>}
            <ul className="af-record-list">
              {visible.map((item) => (
                <li key={rowKey(item)}>
                  <Card size="small" styles={{ body: { padding: 16 } }}>
                    {renderItem(item)}
                  </Card>
                </li>
              ))}
            </ul>
            {paginate && (
              <div className="af-mobile-record-pagination">
                <span>
                  {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, total)} / {total}
                </span>
                <Pagination simple current={current} pageSize={pageSize} total={total} showSizeChanger={false} onChange={setPage} />
              </div>
            )}
          </>
        )}
      </section>
    </ConfigProvider>
  )
}
