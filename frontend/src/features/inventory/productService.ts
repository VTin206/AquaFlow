import { db } from '../../mocks/db'
import { mockError, mockRequest } from '../../mocks/mockRequest'
import { logActivity, requireRole } from '../../mocks/session'
import { isoToVnDate, localToday } from './expiry'
import { tracksExpiry, type Lot, type Product, type ProductDraft, type Receipt, type ReceiptDraft } from './types'

// Đang dùng dữ liệu mẫu. Khi backend có API, thay thân từng hàm bằng api.get/post tương ứng.

const nextProductId = () => {
  const max = Math.max(0, ...db.products.map((product) => Number(product.id.replace('P-', '')) || 0))
  return `P-${String(max + 1).padStart(3, '0')}`
}

export const productService = {
  list: () =>
    mockRequest(() => {
      syncExpiry()
      return db.products
    }),

  create: (draft: ProductDraft) =>
    mockRequest(() => {
      requireRole(['ADMIN', 'SALES_STAFF'], 'thêm sản phẩm')
      const sku = draft.sku.trim()
      if (db.products.some((product) => product.sku.toLowerCase() === sku.toLowerCase())) {
        throw mockError(400, `Mã sản phẩm ${sku} đã tồn tại.`)
      }
      const product: Product = {
        id: nextProductId(),
        name: draft.name.trim(),
        brand: draft.brand?.trim() || 'Chưa có thương hiệu',
        sku,
        unit: draft.unit,
        price: draft.price,
        stock: draft.stock,
        threshold: db.settings.defaultLowStock,
        expiry: '—',
        image: draft.image || undefined,
      }
      db.products.unshift(product)
      logActivity('Kho hàng', product.id, `Thêm sản phẩm ${product.name}`)
      return product
    }),

  lots: () =>
    mockRequest(() => {
      syncExpiry()
      return db.products.flatMap((product) => lotsOf(product)).sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999'))
    }),

  receipts: () => mockRequest(() => [...db.receipts].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt) || b.id.localeCompare(a.id))),

  createReceipt: (draft: ReceiptDraft) =>
    mockRequest(() => {
      requireRole(['ADMIN', 'SALES_STAFF'], 'nhập kho')
      const supplier = db.suppliers.find((item) => item.id === draft.supplierId)
      if (!supplier) throw mockError(400, 'Chọn nhà cung cấp.')
      const today = localToday()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.receivedAt ?? '') || draft.receivedAt > today) throw mockError(400, 'Ngày nhận không hợp lệ hoặc ở tương lai.')
      if (!draft.receiver?.trim()) throw mockError(400, 'Nhập người kiểm nhận.')
      if (!draft.lines?.length) throw mockError(400, 'Phiếu nhập cần ít nhất một dòng hàng.')

      // Kiểm tra toàn bộ dòng trước khi ghi để không nhập dở dang.
      const lines = draft.lines.map(({ damaged = 0, ...rest }, index) => {
        const line = { ...rest, damaged }
        const label = `Dòng ${index + 1}`
        const product = db.products.find((item) => item.id === line.productId)
        if (!product) throw mockError(400, `${label}: chọn sản phẩm.`)
        if (!Number.isSafeInteger(line.received) || line.received <= 0) throw mockError(400, `${label}: số thực nhận phải là số nguyên dương.`)
        if (!Number.isSafeInteger(line.damaged) || line.damaged < 0 || line.damaged > line.received) throw mockError(400, `${label}: số hỏng phải từ 0 đến số thực nhận.`)
        if (!Number.isSafeInteger(line.costPrice) || line.costPrice < 0) throw mockError(400, `${label}: giá vốn không hợp lệ.`)
        const lotCode = line.lotCode?.trim()
        if (tracksExpiry(product)) {
          if (!lotCode) throw mockError(400, `${label}: nhập mã lô in trên bao bì.`)
          if (!line.expiryDate) throw mockError(400, `${label}: nhập hạn sử dụng của lô.`)
          if (line.expiryDate <= today) throw mockError(400, `${label}: lô ${lotCode} đã hết hạn, không nhập vào tồn bán được.`)
          if (line.mfgDate && (line.mfgDate > draft.receivedAt || line.mfgDate >= line.expiryDate)) throw mockError(400, `${label}: ngày sản xuất phải trước ngày nhận và trước hạn dùng.`)
          if (db.lots.some((lot) => lot.productId === product.id && lot.lotCode.toLowerCase() === lotCode.toLowerCase()))
            throw mockError(400, `${label}: lô ${lotCode} của ${product.name} đã được nhập trước đó.`)
        }
        return { ...line, lotCode: lotCode || undefined, product }
      })
      const codes = lines.map((line) => `${line.productId}/${line.lotCode?.toLowerCase()}`)
      if (new Set(codes).size !== codes.length) throw mockError(400, 'Phiếu có hai dòng trùng sản phẩm và mã lô.')

      const id = `PN-${String(Math.max(0, ...db.receipts.map((item) => Number(item.id.replace('PN-', '')) || 0)) + 1).padStart(4, '0')}`
      lines.forEach(({ product, ...line }, index) => {
        const good = line.received - line.damaged
        if (good > 0) {
          db.lots.push({
            id: `LO-${id}-${index + 1}`, productId: product.id, lotCode: line.lotCode ?? `${id}-${index + 1}`,
            mfgDate: line.mfgDate, expiryDate: line.expiryDate, received: good, costPrice: line.costPrice, receiptId: id, receivedAt: draft.receivedAt,
          })
          product.stock += good
        }
      })
      const receipt: Receipt = {
        id, supplierId: supplier.id, supplierName: supplier.name, receivedAt: draft.receivedAt, receiver: draft.receiver.trim(), note: draft.note?.trim() || undefined,
        lines: lines.map(({ product, ...line }) => ({ ...line, productName: product.name, unit: product.unit })),
        total: lines.reduce((sum, line) => sum + (line.received - line.damaged) * line.costPrice, 0),
      }
      db.receipts.push(receipt)
      logActivity('Kho hàng', id, `Nhập kho từ ${supplier.name}: ${receipt.lines.length} dòng, ${receipt.total.toLocaleString('vi-VN')} ₫`)
      syncExpiry()
      return receipt
    }),
}

/**
 * Phân bổ tồn hiện tại vào các lô theo FEFO: phần đã bán/giữ được trừ từ lô hết hạn sớm nhất.
 * Bản mock suy ra từ tổng tồn; backend cần ghi xuất theo từng lô trong transaction.
 */
function lotsOf(product: Product): Lot[] {
  const lots = db.lots.filter((lot) => lot.productId === product.id).sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999'))
  let consumed = Math.max(0, lots.reduce((sum, lot) => sum + lot.received, 0) - product.stock)
  return lots.map((lot) => {
    const used = Math.min(consumed, lot.received)
    consumed -= used
    return { ...lot, remaining: lot.received - used }
  })
}

/** Hạn dùng hiển thị trên sản phẩm = hạn của lô còn hàng hết hạn sớm nhất. */
function syncExpiry() {
  for (const product of db.products) {
    if (!tracksExpiry(product) || !db.lots.some((lot) => lot.productId === product.id)) continue
    const next = lotsOf(product).find((lot) => lot.remaining > 0 && lot.expiryDate)
    product.expiry = next?.expiryDate ? isoToVnDate(next.expiryDate) : '—'
  }
}
