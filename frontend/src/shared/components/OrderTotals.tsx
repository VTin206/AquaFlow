import type { ReactNode } from 'react'

export type TotalsRow = { label: ReactNode; value: ReactNode }

/**
 * Khối tiền cuối chi tiết đơn: căn góc dưới phải, thẳng cột "Thành tiền".
 * Dòng thường chữ nhạt, dòng tổng đậm có kẻ trên; `after` cho các dòng sau tổng (đã thu, còn phải thu, trạng thái).
 * `wide`: chiếm hết chiều ngang (dùng trong thẻ hẹp như báo cáo).
 */
export function OrderTotals({
  rows,
  total,
  after,
  wide = false,
}: {
  rows: TotalsRow[]
  total: TotalsRow
  after?: ReactNode
  wide?: boolean
}) {
  return (
    <dl className={`af-totals${wide ? ' is-wide' : ''}`}>
      {rows.map((row, index) => (
        <div key={index}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
      <div className="is-total">
        <dt>{total.label}</dt>
        <dd>{total.value}</dd>
      </div>
      {after}
    </dl>
  )
}
