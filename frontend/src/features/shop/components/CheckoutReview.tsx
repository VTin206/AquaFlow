import { Money } from '@/shared/components/Money'
import { currency } from '@/shared/utils/format'
import type { CartLine } from '../cart'
import type { ShopProduct } from '../shopService'
import { CartThumb } from './CartThumb'
import type { ReactNode } from 'react'

export type CheckoutLine = CartLine & { product?: ShopProduct }

/** Danh sách hàng và tiền của đơn đang đặt. `fee === null` nghĩa là chưa có báo phí. */
export function CheckoutReview({ lines, subtotal, fee, depositHint }: { lines: CheckoutLine[]; subtotal: number; fee: number | null; depositHint: ReactNode }) {
  return (
    <>
      <ul className="af-checkout-lines">
        {lines.map((line) => (
          <li key={line.productId}>
            <CartThumb product={line.product} />
            <div>
              <strong>{line.product?.name ?? `Sản phẩm ${line.productId}`}</strong>
              <small>
                {line.product ? `${currency(line.product.price)} / ${line.product.unit.toLowerCase()} × ${line.quantity}` : 'Không còn trong danh mục'}
              </small>
            </div>
            {line.product && <span className="af-money af-checkout-line-total">{currency(line.product.price * line.quantity)}</span>}
          </li>
        ))}
      </ul>
      <dl className="af-checkout-totals">
        <div>
          <dt>Tiền hàng</dt>
          <dd className="af-money">{currency(subtotal)}</dd>
        </div>
        <div>
          <dt>Phí giao</dt>
          <dd>{fee === null ? 'Chưa có báo phí' : fee === 0 ? 'Miễn phí' : <span className="af-money">{currency(fee)}</span>}</dd>
        </div>
        <div className="is-total">
          <dt>{fee === null ? 'Tạm tính' : 'Tổng cộng'}</dt>
          <dd>
            <Money value={subtotal + (fee ?? 0)} tone="due" />
          </dd>
        </div>
      </dl>
      <div className="af-form-hint">{depositHint}</div>
    </>
  )
}
