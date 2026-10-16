export type Section = 'overview' | 'orders' | 'inventory' | 'products' | 'customers' | 'delivery' | 'reports'

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

export type Product = {
  id: string
  name: string
  brand: string
  unit: string
  stock: number
  threshold: number
  price: number
  expiry: string
  sku: string
  image?: string
}

export type Customer = {
  name: string
  phone: string
  area: string
  orders: number
  balance: string
  initials: string
}

export type OrderDraft = { customer: string; product: string; quantity: number }

export type StockDraft = { productId: string; quantity: number }

export type ProductDraft = {
  name: string
  brand: string
  sku: string
  unit: string
  price: number
  stock: number
  image: string
}
