export type OrderStatus = 'Chờ xác nhận' | 'Đang chuẩn bị' | 'Đang giao' | 'Đã hoàn tất'

export type Order = {
  id: string
  customer: string
  phone: string
  address: string
  items: string
  total: number
  time: string
  status: OrderStatus
  method: string
}

export type OrderDraft = { customer: string; productId: string; quantity: number }
