import { Money } from '@/shared/components/Money'

/**
 * Còn phải thu của một khách, nói rõ thay vì để trống: đang nợ thì hiện số tiền, đã mua và trả hết thì "Đã thu đủ",
 * chưa mua lần nào thì "Chưa có đơn". Dấu "—" dễ bị hiểu là lỗi dữ liệu.
 */
export function CustomerDebt({ debt, orders }: { debt: number; orders: number }) {
  if (debt > 0) return <Money value={debt} tone="due" />
  if (orders > 0) return <span className="af-money is-paid">Đã thu đủ</span>
  return <span className="af-text-muted">Chưa có đơn</span>
}
