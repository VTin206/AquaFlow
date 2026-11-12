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
  catalog?: { category: string; packaging: string; capacity: string; volumeMl: number }
  /** false khi đã ngừng kinh doanh; thiếu nghĩa là đang bán. */
  active?: boolean
}

export type ReceiptLine = {
  productId: string
  lotCode?: string
  mfgDate?: string
  expiryDate?: string
  /** Số đếm thực tế khi kiểm nhận. */
  received: number
  /** Hỏng/không đạt trong số thực nhận; không tăng tồn bán được. */
  damaged: number
  costPrice: number
}

export type ReceiptDraft = { supplierId: string; receivedAt: string; receiver: string; note?: string; lines: ReceiptLine[] }
