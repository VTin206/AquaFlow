import { relativeDateTime } from '@/shared/utils/format'
export type OrderStatus = 'Chờ xác nhận' | 'Đã xác nhận' | 'Đang chuẩn bị' | 'Đang giao' | 'Đã giao' | 'Giao thất bại' | 'Đã hoàn tất' | 'Đã hủy'

export type OrderLine = { productId: string; name: string; unit: string; quantity: number; unitPrice: number }
export type Payment = {
  id: string
  /** Luôn dương; phiếu hoàn tiền có `refund` và được trừ khi tính số đã thu. */
  amount: number
  method: 'Tiền mặt' | 'Chuyển khoản'
  reference?: string
  recordedAt: string
  refund?: boolean
  /** Nhân viên ghi phiếu. */
  by?: string
}
export type PaymentDraft = Pick<Payment, 'amount' | 'method' | 'reference'>
export type RefundDraft = Pick<Payment, 'method' | 'reference'>
export type OrderEvent = { at: string; message: string; by?: string }
/** Hàng khách trả lại sau khi đã nhận. */
export type OrderReturn = {
  id: string
  at: string
  by?: string
  lines: OrderLine[]
  reason: string
  /** true: hàng còn tốt, nhập lại tồn bán được; false: hỏng, loại bỏ. */
  restocked: boolean
  refunded: number
}
export type ReturnDraft = {
  lines: { productId: string; quantity: number }[]
  reason: string
  restock: boolean
  refundMethod?: Payment['method']
  refundReference?: string
}
/** Một dòng hàng theo lô; `lotCode` trống khi sản phẩm không quản lý theo lô. */
export type LotLine = { productId: string; name: string; unit: string; lotCode?: string; expiryDate?: string; quantity: number }
/** Một lần xuất kho đi giao (DISPATCH): xuất toàn bộ hàng của đơn, ghi theo lô FEFO. */
export type StockDispatch = { at: string; by?: string; tripId?: string; lines: LotLine[] }
/** Kiểm hàng mang về sau khi giao thất bại: chỉ phần bán lại được mới nhập lại kho (RETURN). */
export type ReturnInspection = { at: string; by?: string; note?: string; lines: (LotLine & { sellable: number; damaged: number })[] }
export type ReturnInspectionDraft = { sellable: number[]; note?: string }

export type DeliveryResult = {
  success: boolean
  receiver?: string
  reason?: string
  /** Vỏ rỗng thu về khi giao bình. */
  bottlesReturned?: number
  /** Tiền cọc thu thêm cho vỏ khách giữ; tách khỏi phiếu thu tiền hàng. */
  depositCollected?: number
}
/** Vỏ bình bàn giao kèm đơn. */
export type OrderBottles = { delivered: number; returned: number; deposit: number }

export type Order = {
  id: string
  /** Mã hiển thị khi khác `id` (tài khoản thật: orderCode của BE). */
  code?: string
  /** Trạng thái thanh toán do BE trả về; bản dùng thử tính từ các phiếu thu. */
  paymentStatusLabel?: string
  /** Hồ sơ khách gắn với đơn; khách vãng lai không có. */
  customerId?: string
  customer: string
  phone: string
  address: string
  items: string
  total: number
  time: string
  status: OrderStatus
  method: 'Tại quầy' | 'Giao tận nơi'
  channel: 'Tại quầy' | 'Điện thoại' | 'Tin nhắn' | 'Website'
  lines: OrderLine[]
  deliveryFee: number
  /** Lầu giao bằng thang bộ (0: tầng trệt hoặc có thang máy), dùng tính phụ thu. */
  floor?: number
  appointment?: string
  note?: string
  payments: Payment[]
  history: OrderEvent[]
  stockReserved: boolean
  bottles?: OrderBottles
  /** Thời điểm khách nhận hàng (giao thành công hoặc nhận tại quầy). */
  deliveredAt?: string
  returns?: OrderReturn[]
  dispatches?: StockDispatch[]
  returnInspections?: ReturnInspection[]
  /** Mã bí mật trong liên kết tra cứu gửi cho khách. */
  trackingToken?: string
}

export type OrderDraft = {
  customer?: string
  phone?: string
  address?: string
  method: Order['method']
  channel: Order['channel']
  lines: { productId: string; quantity: number }[]
  deliveryFee: number
  floor?: number
  appointment?: string
  note?: string
}

export const paidAmount = (order: Order) => order.payments.reduce((sum, payment) => sum + (payment.refund ? -payment.amount : payment.amount), 0)
export const amountDue = (order: Order) => Math.max(0, order.total - paidAmount(order))
export const paymentLabel = (order: Order) =>
  order.paymentStatusLabel ?? (order.status === 'Đã hủy' ? 'Đã hủy' : amountDue(order) === 0 ? 'Đã thanh toán' : paidAmount(order) > 0 ? 'Thanh toán một phần' : 'Chưa thanh toán')

/** Số bình (có vỏ luân chuyển) trong đơn. */
export const jugCount = (order: Pick<Order, 'lines'>) => order.lines.filter((line) => line.unit === 'Bình').reduce((sum, line) => sum + line.quantity, 0)

export const createdAtOf = (order: Pick<Order, 'history'>) => order.history[0]?.at

/** Lúc đặt đơn: nhãn ngắn theo ngày ("Hôm qua 13:10") và ngày giờ đầy đủ cho tooltip; thiếu thời điểm thì dùng giờ có sẵn. */
export const orderedAtOf = (order: Pick<Order, 'history' | 'time'>) => {
  const at = createdAtOf(order)
  return at ? { label: relativeDateTime(at), full: new Date(at).toLocaleString('vi-VN') } : { label: order.time, full: order.time }
}

/** Hàng đang ở ngoài kho chờ kiểm: lần xuất gần nhất (hoặc cả đơn với dữ liệu cũ chưa ghi lần xuất). */
export const returnLinesOf = (order: Order): LotLine[] =>
  order.dispatches?.at(-1)?.lines ?? order.lines.map(({ productId, name, unit, quantity }) => ({ productId, name, unit, quantity }))

/** Giao thất bại nhưng chưa kiểm hàng mang về thì chưa được hủy hay giao lại. */
export const awaitingReturnInspection = (order: Order) => {
  if (order.status !== 'Giao thất bại') return false
  const lastDispatch = order.dispatches?.at(-1)?.at
  return !(order.returnInspections ?? []).some((inspection) => !lastDispatch || inspection.at >= lastDispatch)
}

export type DeliveryAttempt = { at: string; by?: string; success: boolean; reason?: string }
/** Các lần giao suy ra từ lịch sử đơn (giao thành công / thất bại). */
export const deliveryAttempts = (order: Pick<Order, 'history'>): DeliveryAttempt[] =>
  order.history
    .filter((event) => /^Giao (thành công|thất bại)/.test(event.message))
    .map((event) => ({
      at: event.at,
      by: event.by,
      success: event.message.startsWith('Giao thành công'),
      reason: event.message.startsWith('Giao thất bại') ? event.message.replace(/^Giao thất bại:\s*/, '') : undefined,
    }))

/** Giá trị hàng đã nhận trả lại. */
export const returnedValue = (order: Pick<Order, 'returns'>) =>
  (order.returns ?? []).flatMap((item) => item.lines).reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)

const OPEN_DELIVERY: OrderStatus[] = ['Chờ xác nhận', 'Đã xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Giao thất bại']

/** Số phút trễ so với giờ hẹn: đơn chưa giao tính tới hiện tại, đơn đã giao tính tới lúc nhận. 0 nếu đúng hẹn. */
export function minutesLate(order: Order, now = Date.now()) {
  if (order.method !== 'Giao tận nơi' || !order.appointment || order.status === 'Đã hủy') return 0
  const due = Date.parse(order.appointment)
  const end = OPEN_DELIVERY.includes(order.status) ? now : order.deliveredAt ? Date.parse(order.deliveredAt) : due
  return Math.max(0, Math.floor((end - due) / 60_000))
}

/** Đơn giao chưa xong đã quá giờ hẹn, cần ưu tiên hoặc báo khách. */
export const isOverdue = (order: Order, now = Date.now()) => OPEN_DELIVERY.includes(order.status) && minutesLate(order, now) > 0

/** Giờ hẹn của đơn giao chưa xong; `tone` đỏ khi đã trễ, cam khi còn dưới 1 giờ. Không có hẹn hoặc đã giao xong thì null. */
export function appointmentOf(order: Order, now = Date.now()) {
  if (order.method !== 'Giao tận nơi' || !order.appointment || !OPEN_DELIVERY.includes(order.status)) return null
  const minutesLeft = (Date.parse(order.appointment) - now) / 60_000
  const tone = isOverdue(order, now) ? 'danger' : minutesLeft <= 60 ? 'warning' : 'muted'
  return { label: `Hẹn ${relativeDateTime(order.appointment, new Date(now))}`, full: new Date(order.appointment).toLocaleString('vi-VN'), tone } as const
}

export const lateLabel = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} giờ ${minutes % 60 ? `${minutes % 60} phút` : ''}`.trim() : `${minutes} phút`)

/** Thông tin đơn khách xem được trên trang tra cứu. */
export type PublicOrder = Pick<Order, 'id' | 'customer' | 'address' | 'status' | 'method' | 'lines' | 'deliveryFee' | 'total' | 'appointment' | 'deliveredAt' | 'trackingToken'> & {
  paid: number
  due: number
  createdAt?: string
}
