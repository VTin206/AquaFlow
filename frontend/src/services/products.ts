import { db } from '../mocks/db'
import { mockError, mockRequest } from '../mocks/mockRequest'
import type { Product, ProductDraft, StockDraft } from '../types'

// Đang dùng dữ liệu mẫu. Khi backend có API, thay thân từng hàm bằng api.get/post tương ứng.

const nextProductId = () => {
  const max = Math.max(0, ...db.products.map((product) => Number(product.id.replace('P-', '')) || 0))
  return `P-${String(max + 1).padStart(3, '0')}`
}

export const productService = {
  list: () => mockRequest(() => db.products),

  create: (draft: ProductDraft) =>
    mockRequest(() => {
      const sku = draft.sku.trim()
      if (db.products.some((product) => product.sku.toLowerCase() === sku.toLowerCase())) {
        throw mockError(400, `Mã sản phẩm ${sku} đã tồn tại.`)
      }
      const product: Product = {
        id: nextProductId(),
        name: draft.name.trim(),
        brand: draft.brand.trim() || 'AquaFlow',
        sku,
        unit: draft.unit,
        price: draft.price,
        stock: draft.stock,
        threshold: 10,
        expiry: '—',
        image: draft.image || undefined,
      }
      db.products.unshift(product)
      return product
    }),

  receiveStock: (draft: StockDraft) =>
    mockRequest(() => {
      const product = db.products.find((item) => item.id === draft.productId)
      if (!product) throw mockError(404, 'Không tìm thấy sản phẩm.')
      product.stock += draft.quantity
      return product
    }),
}
