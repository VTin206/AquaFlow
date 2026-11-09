import { db } from '@/mocks/db'
import { mockError, mockRequest } from '@/mocks/mockRequest'
import { localToday } from './expiry'
import type { ReceiptForm, ReceiptView } from './useInventory'

// Phiếu nháp mẫu chỉ nằm ở bản dùng thử; khi nhập kho mới chuyển thành phiếu thật trong dữ liệu mẫu.
let drafts: ReceiptView[] | undefined
let nextCode = 2

const code = (value: number) => `NH-${String(value).padStart(4, '0')}`

const sample = (): ReceiptView[] => {
  const supplier = db.suppliers[0]
  const product = db.products.find((item) => item.unit !== 'Vỏ')
  if (!supplier || !product) return []
  const costPrice = Math.round(product.price * 0.7)
  return [
    {
      id: code(1),
      code: code(1),
      status: 'DRAFT',
      supplierId: supplier.id,
      supplierName: supplier.name,
      receivedAt: localToday(),
      receiver: 'Nguyễn An',
      note: 'Phiếu nháp mẫu, chưa cộng tồn.',
      total: 20 * costPrice,
      lines: [
        {
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          lotCode: 'NHAP-MAU-01',
          expiryDate: `${Number(localToday().slice(0, 4)) + 1}-12-31`,
          received: 20,
          damaged: 0,
          costPrice,
        },
      ],
    },
  ]
}

const all = () => (drafts ??= sample())

export const demoReceiptDrafts = {
  list: () => mockRequest(() => all()),
  get: (id: string) => all().find((draft) => draft.id === id),
  remove: (id: string) => {
    drafts = all().filter((draft) => draft.id !== id)
  },
  save: (form: ReceiptForm, id?: string) =>
    mockRequest(() => {
      const supplier = db.suppliers.find((item) => item.id === form.supplierId)
      if (!supplier) throw mockError(400, 'Chọn nhà cung cấp.')
      if (!form.lines?.length) throw mockError(400, 'Phiếu nhập cần ít nhất một dòng hàng.')
      const lines = form.lines.map((line, index) => {
        const product = db.products.find((item) => item.id === line.productId)
        if (!product) throw mockError(400, `Dòng ${index + 1}: chọn sản phẩm.`)
        return { ...line, damaged: line.damaged ?? 0, productName: product.name, unit: product.unit }
      })
      const value = id ?? code(nextCode++)
      const saved: ReceiptView = {
        id: value,
        code: value,
        status: 'DRAFT',
        supplierId: supplier.id,
        supplierName: supplier.name,
        receivedAt: form.receivedAt,
        receiver: form.receiver,
        note: form.note,
        total: lines.reduce((sum, line) => sum + (line.received - line.damaged) * line.costPrice, 0),
        lines,
      }
      drafts = id ? all().map((draft) => (draft.id === id ? saved : draft)) : [saved, ...all()]
      return saved
    }),
  cancel: (id: string) =>
    mockRequest(() => {
      const current = all().find((draft) => draft.id === id)
      if (!current) throw mockError(404, 'Không tìm thấy phiếu nháp.')
      const cancelled: ReceiptView = { ...current, status: 'CANCELLED' }
      drafts = all().map((draft) => (draft.id === id ? cancelled : draft))
      return cancelled
    }),
}
