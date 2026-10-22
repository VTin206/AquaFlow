import type { ReactNode } from 'react'
import { currency } from '../utils/format'
import type { MoneyTone } from '../utils/money'

/** Số tiền tô màu theo ý nghĩa; quy ước màu ở shared/utils/money.ts. */
export function Money({ value, tone = 'neutral', prefix }: { value: number; tone?: MoneyTone; prefix?: ReactNode }) {
  return (
    <span className={`af-money is-${tone}`}>
      {prefix}
      {tone === 'refund' && value > 0 ? '−' : ''}
      {currency(value)}
    </span>
  )
}
