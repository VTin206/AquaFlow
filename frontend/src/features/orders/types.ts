export type OrderStatus = 'Chờ xác nhận' | 'Đang chuẩn bị' | 'Đang giao' | 'Đã giao' | 'Giao thất bại' | 'Đã hoàn tất' | 'Đã hủy'

export type OrderLine = { productId: string; name: string; unit: string; quantity: number; unitPrice: number }
export type Payment = { id: string; amount: number; method: 'Tiền mặt' | 'Chuyển khoản'; reference?: string; recordedAt: string }
export type PaymentDraft = Pick<Payment, 'amount' | 'method' | 'reference'>
export type OrderEvent = { at: string; message: string }
export type DeliveryResult = { success: boolean; receiver?: string; reason?: string }

export type Order = {
  id: string
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
  appointment?: string
  note?: string
  payments: Payment[]
  history: OrderEvent[]
  stockReserved: boolean
}

export type OrderDraft = {
  customer?: string
  phone?: string
  address?: string
  method: Order['method']
  channel: Order['channel']
  lines: { productId: string; quantity: number }[]
  deliveryFee: number
  appointment?: string
  note?: string
}

export const paidAmount = (order: Order) => order.payments.reduce((sum, payment) => sum + payment.amount, 0)
export const amountDue = (order: Order) => Math.max(0, order.total - paidAmount(order))
export const paymentLabel = (order: Order) =>
  order.status === 'Đã hủy' ? 'Đã hủy' : amountDue(order) === 0 ? 'Đã thanh toán' : paidAmount(order) > 0 ? 'Thanh toán một phần' : 'Chưa thanh toán'
