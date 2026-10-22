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
}

export type ProductDraft = {
  name: string
  brand?: string
  sku: string
  unit: string
  price: number
  stock: number
  image?: string
}


export const isLowStock = (product: Product) => product.stock <= product.threshold

/** Lô hàng đạt yêu cầu đã nhập kho. Ngày dạng ISO "yyyy-mm-dd". */
export type Lot = {
  id: string
  productId: string
  lotCode: string
  mfgDate?: string
  expiryDate?: string
  /** Số lượng đạt nhập vào tồn bán được (đã trừ hàng hỏng). */
  received: number
  /** Còn lại theo nguyên tắc hết hạn trước xuất trước (FEFO). */
  remaining: number
  costPrice: number
  receiptId: string
  receivedAt: string
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

export type Receipt = Omit<ReceiptDraft, 'lines'> & {
  id: string
  supplierName: string
  lines: (ReceiptLine & { productName: string; unit: string })[]
  /** Giá trị nhập theo giá vốn của hàng đạt. */
  total: number
}

/** Sản phẩm có quản lý hạn dùng theo lô (vỏ bình thì không). */
export const tracksExpiry = (product: Pick<Product, 'unit'>) => product.unit !== 'Vỏ'
