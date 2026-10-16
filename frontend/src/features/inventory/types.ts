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

export type ProductDraft = {
  name: string
  brand?: string
  sku: string
  unit: string
  price: number
  stock: number
  image?: string
}

export type StockDraft = { productId: string; quantity: number }

export const isLowStock = (product: Product) => product.stock <= product.threshold
