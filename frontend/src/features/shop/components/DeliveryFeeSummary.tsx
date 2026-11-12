import type { ReactNode } from 'react'
import { currency } from '@/shared/utils/format'
import type { DeliveryFees } from '@/features/settings/types'
import type { DeliveryQuote } from '../deliveryQuoteApi'
import { baseFeeText, stairsFeeText } from '../deliveryFeeText'

type Props = {
  fee: number | null
  /** Chỉ có khi báo giá đã sẵn sàng. */
  quote?: DeliveryQuote
  /** Mức phí của lần báo giá gần nhất, giữ lại khi đang tính lại để dòng cách tính không nhấp nháy. */
  fees?: DeliveryFees
  loading: boolean
  error?: ReactNode
}

/** Khối phí giao ở trang đặt hàng: mỗi khoản đi kèm cách tính theo cài đặt cửa hàng, tổng nằm dưới cùng. */
export function DeliveryFeeSummary({ fee, quote, fees, loading, error }: Props) {
  return (
    <section className="af-checkout-fee" aria-label="Phí giao hàng">
      <div className="af-checkout-fee-row">
        <div>
          <span>Phí cơ bản</span>
          {fees && <small>{baseFeeText(fees)}</small>}
        </div>
        {quote && <span>{currency(quote.baseFee)}</span>}
      </div>
      <div className="af-checkout-fee-row">
        <div>
          <span>Phí thang bộ</span>
          {fees && <small>{stairsFeeText(fees.stairsPerJug)}</small>}
        </div>
        {quote && <span>{currency(quote.stairsFee)}</span>}
      </div>
      {error ?? (
        <div className="af-checkout-fee-total">
          <strong>Phí giao hàng</strong>
          {loading ? <span role="status">Đang tính…</span> : <strong>{currency(fee ?? 0)}</strong>}
        </div>
      )}
    </section>
  )
}
