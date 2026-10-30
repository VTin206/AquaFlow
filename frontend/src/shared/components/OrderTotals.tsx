import type { ReactNode } from 'react'

export type TotalsRow = { label: ReactNode; value: ReactNode }

/**
 * Khối tiền cuối chi tiết đơn: căn góc dưới phải, thẳng cột "Thành tiền".
 * Dòng thường chữ nhạt, dòng tổng đậm có kẻ trên; `after` cho các dòng sau tổng (đã thu, còn phải thu, trạng thái).
 */
export function OrderTotals({ rows, total, after }: { rows: TotalsRow[]; total: TotalsRow; after?: ReactNode }) {
  return (
    <dl className="af-totals">
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
