import type { ReactNode } from 'react'
import { currency } from '@/shared/utils/format'
import type { DeliveryQuote } from '../deliveryQuoteApi'

type Props = {
  fee: number | null
  /** Chỉ có khi báo giá từ server đã sẵn sàng; bản dùng thử không có phần tách phí. */
  quote?: DeliveryQuote
  loading: boolean
  error?: ReactNode
}

/** Khối phí giao ở trang đặt hàng: mỗi khoản đi kèm cách tính, tổng nằm dưới cùng. */
export function DeliveryFeeSummary({ fee, quote, loading, error }: Props) {
  return (
    <section className="af-checkout-fee" aria-label="Phí giao hàng">
      <div className="af-checkout-fee-row">
        <div>
          <span>Phí cơ bản</span>
          <small>Dưới 3 sản phẩm: 15.000 ₫ · Từ 3 sản phẩm: miễn phí</small>
        </div>
        {quote && <span>{currency(quote.baseFee)}</span>}
      </div>
      <div className="af-checkout-fee-row">
        <div>
          <span>Phí thang bộ</span>
          <small>Tầng 1–2: 2.000 ₫/bình/tầng · Tầng 3: 8.000 ₫/bình · Từ tầng 4: 12.000 ₫/bình</small>
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
