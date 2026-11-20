import type { ReactNode } from 'react'
import { currency } from '@/shared/utils/format'
import type { DeliveryFees } from '@/features/settings/types'
import type { DeliveryQuote } from '../deliveryQuoteApi'
import { baseFeeText, stairsFeeText } from '../deliveryFeeText'

type Props = {
  /** Chỉ có khi báo giá đã sẵn sàng. */
  quote?: DeliveryQuote
  /** Mức phí của lần báo giá gần nhất, giữ lại khi đang tính lại để dòng cách tính không nhấp nháy. */
  fees?: DeliveryFees
  error?: ReactNode
}

// Chưa có mức phí (đang tải lần đầu, hoặc backend cũ chưa trả `fees`): giải thích chung, không ghi số tiền có thể sai.
const BASE_FEE_FALLBACK = 'Miễn phí khi đơn đủ số sản phẩm cửa hàng quy định'
const STAIRS_FEE_FALLBACK = 'Tính cho mỗi bình/thùng theo số tầng đi thang bộ. Chai, lon lẻ không tính.'

/** Hai khoản của phí giao, hiện nhỏ ngay dưới dòng "Phí giao" trong bảng tiền của đơn. */
export function DeliveryFeeSummary({ quote, fees, error }: Props) {
  return (
    <div className="af-checkout-fee" aria-label="Cách tính phí giao">
      <div className="af-checkout-fee-row">
        <div>
          <span>Phí cơ bản</span>
          <small>{fees ? baseFeeText(fees) : BASE_FEE_FALLBACK}</small>
        </div>
        {quote && <span>{currency(quote.baseFee)}</span>}
      </div>
      <div className="af-checkout-fee-row">
        <div>
          <span>Phí thang bộ</span>
          <small>{fees ? stairsFeeText(fees.stairsPerJug) : STAIRS_FEE_FALLBACK}</small>
        </div>
        {quote && <span>{currency(quote.stairsFee)}</span>}
      </div>
      {error}
    </div>
  )
}
