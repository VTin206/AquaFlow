import { vnToIsoDate } from '@/features/inventory/expiry'
import type { Lot, Product, Receipt } from '@/features/inventory/types'
import { initialProducts } from './data'
import { initialSuppliers } from './suppliers'

export type StoredLot = Omit<Lot, 'remaining'>

// Hai phiếu nhập minh họa; phần tồn còn lại của mỗi sản phẩm là lô tồn đầu kỳ.
const demoReceipts: { id: string; supplierId: string; receivedAt: string; receiver: string; note?: string; lines: [productId: string, lotCode: string, mfg: string, expiry: string, received: number, damaged: number, cost: number][] }[] = [
  {
    id: 'PN-0001',
    supplierId: 'NCC-001',
    receivedAt: '2026-10-10',
    receiver: 'Nguyễn An',
    lines: [
      ['P-009', 'VH2609-20L', '2026-09-26', '2027-03-26', 20, 0, 42000],
      ['P-016', 'AQ2608-500', '2026-08-15', '2027-08-15', 24, 1, 68000],
    ],
  },
  {
    id: 'PN-0002',
    supplierId: 'NCC-002',
    receivedAt: '2026-10-14',
    receiver: 'Nguyễn An',
    note: 'Thiếu 2 thùng so với hóa đơn, nhà cung cấp hẹn bù chuyến sau.',
    lines: [['P-004', 'LV2609-19L', '2026-09-30', '2027-03-30', 18, 0, 40000]],
  },
]

const product = (id: string) => initialProducts.find((item) => item.id === id) as Product
const supplierName = (id: string) => initialSuppliers.find((supplier) => supplier.id === id)?.name ?? id

export const initialReceipts: Receipt[] = demoReceipts.map((receipt) => {
  const lines = receipt.lines.map(([productId, lotCode, mfgDate, expiryDate, received, damaged, costPrice]) => ({
    productId, lotCode, mfgDate, expiryDate, received, damaged, costPrice,
    productName: product(productId).name, unit: product(productId).unit,
  }))
  return {
    id: receipt.id, supplierId: receipt.supplierId, supplierName: supplierName(receipt.supplierId),
    receivedAt: receipt.receivedAt, receiver: receipt.receiver, note: receipt.note, lines,
    total: lines.reduce((sum, line) => sum + (line.received - line.damaged) * line.costPrice, 0),
  }
})

const receiptLots: StoredLot[] = initialReceipts.flatMap((receipt) =>
  receipt.lines.map((line, index) => ({
    id: `LO-${receipt.id}-${index + 1}`, productId: line.productId, lotCode: line.lotCode!, mfgDate: line.mfgDate, expiryDate: line.expiryDate,
    received: line.received - line.damaged, costPrice: line.costPrice, receiptId: receipt.id, receivedAt: receipt.receivedAt,
  })),
)

// Lô tồn đầu kỳ gom phần tồn trước khi dùng hệ thống, hạn dùng lấy từ dữ liệu sản phẩm.
const openingLots: StoredLot[] = initialProducts.flatMap((item) => {
  const fromReceipts = receiptLots.filter((lot) => lot.productId === item.id).reduce((sum, lot) => sum + lot.received, 0)
  const quantity = item.stock - fromReceipts
  return quantity > 0
    ? [{
        id: `LO-DK-${item.id}`, productId: item.id, lotCode: `DK-${item.sku}`, expiryDate: vnToIsoDate(item.expiry),
        received: quantity, costPrice: Math.round(item.price * 0.7 / 1000) * 1000, receiptId: 'Tồn đầu kỳ', receivedAt: '2026-10-01',
      }]
    : []
})

export const initialLots: StoredLot[] = [...openingLots, ...receiptLots]
