import { useState, type ReactNode } from 'react'
import { Card, ConfigProvider, Empty, Pagination, Skeleton } from 'antd'

type MobileRecordListProps<T> = {
  items: T[]
  rowKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  loading?: boolean
  emptyText: string
  label: string
  paginate?: boolean
  controls?: ReactNode
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
}: MobileRecordListProps<T>) {
  const [page, setPage] = useState(1)
  const pageSize = 10
  // Dữ liệu có thể giảm sau khi lọc hoặc cập nhật; không để trang hiện tại trống giả.
  const current = Math.min(page, Math.max(1, Math.ceil(items.length / pageSize)))
  const visible = paginate ? items.slice((current - 1) * pageSize, current * pageSize) : items

  return (
    <ConfigProvider theme={{ token: { controlHeight: 44, fontSizeSM: 13 } }}>
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
                  {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, items.length)} / {items.length}
                </span>
                <Pagination simple current={current} pageSize={pageSize} total={items.length} showSizeChanger={false} onChange={setPage} />
              </div>
            )}
          </>
        )}
      </section>
    </ConfigProvider>
  )
}
