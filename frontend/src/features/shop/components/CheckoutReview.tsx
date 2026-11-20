import { Button } from 'antd'
import { Money } from '@/shared/components/Money'
import { currency } from '@/shared/utils/format'
import type { CartLine } from '../cart'
import type { ShopProduct } from '../shopService'
import { CartThumb } from './CartThumb'
import type { ShellDeposit } from './CheckoutDeposit'
import type { ReactNode } from 'react'

export type CheckoutLine = CartLine & { product?: ShopProduct }

type Props = {
  lines: CheckoutLine[]
  subtotal: number
  /** `null`: chưa báo được phí. */
  fee: number | null
  /** Cách tính phí giao (cơ bản, thang bộ), hiện nhỏ dưới dòng phí. */
  feeDetail?: ReactNode
  /** Lựa chọn vỏ bình, đặt ngay dưới các sản phẩm. */
  shellPicker?: ReactNode
  /** Chỉ truyền khi khách chọn cọc vỏ mới. */
  deposit?: ShellDeposit
  total: number
  totalLabel: string
}

/** Đơn đang đặt: sản phẩm, vỏ bình, rồi các khoản tiền và tổng. */
export function CheckoutReview({ lines, subtotal, fee, feeDetail, shellPicker, deposit, total, totalLabel }: Props) {
  return (
    <>
      <ul className="af-checkout-lines">
        {lines.map((line) => (
          <li key={line.productId}>
            <CartThumb product={line.product} />
            <div>
              <strong>{line.product?.name ?? `Sản phẩm ${line.productId}`}</strong>
              <small>
                {line.product
                  ? `${currency(line.product.price)} / ${line.product.unit.toLowerCase()} × ${line.quantity}`
                  : 'Không còn trong danh mục'}
              </small>
            </div>
            {line.product && <span className="af-money af-checkout-line-total">{currency(line.product.price * line.quantity)}</span>}
          </li>
        ))}
      </ul>
      {shellPicker}
      <dl className="af-checkout-totals">
        <div>
          <dt>Tiền hàng</dt>
          <dd className="af-money">{currency(subtotal)}</dd>
        </div>
        <div>
          <dt>Phí giao</dt>
          <dd>{fee === null ? 'Chưa có báo phí' : fee === 0 ? 'Miễn phí' : <span className="af-money">{currency(fee)}</span>}</dd>
        </div>
        {feeDetail}
        {deposit && deposit.status !== 'none' && (
          <div>
            <dt>Cọc vỏ ({deposit.count} vỏ)</dt>
            <dd>
              {deposit.status === 'ready' ? (
                <span className="af-money">{currency(deposit.amount ?? 0)}</span>
              ) : deposit.status === 'loading' ? (
                <span role="status">Đang tải…</span>
              ) : deposit.status === 'error' ? (
                <Button size="small" onClick={deposit.refetch}>
                  Tải lại giá cọc
                </Button>
              ) : (
                'Cửa hàng báo khi gọi'
              )}
            </dd>
          </div>
        )}
        <div className="is-total">
          <dt>{totalLabel}</dt>
          <dd>
            <Money value={total} tone="due" />
          </dd>
        </div>
      </dl>
    </>
  )
}
