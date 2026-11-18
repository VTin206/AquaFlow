import { useQuery } from '@tanstack/react-query'
import { Button } from 'antd'
import { bottleTypeApi } from '@/features/live/bottleTypeApi'
import { currency } from '@/shared/utils/format'
import type { CheckoutLine } from './CheckoutReview'

/** Deposit is an estimate for no exchanged shells, not a sale payment or a confirmed charge. */
export function CheckoutDeposit({ lines }: { lines: CheckoutLine[] }) {
  const quantities = new Map<number, number>()
  for (const line of lines) {
    const id = line.product?.bottleTypeId
    if (id != null && Number.isSafeInteger(line.quantity) && line.quantity > 0)
      quantities.set(id, (quantities.get(id) ?? 0) + line.quantity)
  }
  const rates = useQuery({
    queryKey: ['shop', 'bottle-deposit-rates', 'live'],
    queryFn: () => bottleTypeApi.list(true),
    enabled: quantities.size > 0,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 30000,
  })
  if (quantities.size === 0) return <p>Cửa hàng xác nhận tiền cọc nếu sản phẩm cần đổi vỏ.</p>
  if (rates.isError) return <p role="alert">Chưa cập nhật được giá cọc. Cửa hàng sẽ xác nhận trước khi giao. <Button size="small" onClick={() => void rates.refetch()}>Tải lại giá cọc</Button></p>
  if (rates.isPending) return <p role="status">Đang tải giá cọc theo loại vỏ…</p>
  const rows = [...quantities].map(([id, quantity]) => ({ type: rates.data.find(t => t.id === id && t.active), quantity }))
  const complete = rows.every(({ type }) => type != null && Number.isFinite(Number(type.depositUnitAmount)) && Number(type.depositUnitAmount) >= 0)
  return <section aria-label="Tiền cọc vỏ dự kiến">
    <p>Tiền hàng phía trên chưa gồm cọc. Nếu không có vỏ cùng loại để đổi:</p>
    <ul>{rows.map(({ type, quantity }, index) => <li key={[...quantities.keys()][index]}>
      {type && Number.isFinite(Number(type.depositUnitAmount)) && Number(type.depositUnitAmount) >= 0
        ? `${type.name}: ${quantity} vỏ × ${currency(Number(type.depositUnitAmount))} = ${currency(quantity * Number(type.depositUnitAmount))}`
        : `${quantity} vỏ: chưa có giá cọc khả dụng, cửa hàng sẽ xác nhận.`}
    </li>)}</ul>
    {complete && <p><strong>Cọc dự kiến khi không đổi vỏ: {currency(rows.reduce((sum, { type, quantity }) => sum + Number(type!.depositUnitAmount) * quantity, 0))}</strong></p>}
    <p>Chỉ thu cọc cho số vỏ còn thiếu sau khi đối chiếu vỏ thực trả. Cửa hàng xác nhận số tiền cuối cùng khi nhận đơn.</p>
  </section>
}
