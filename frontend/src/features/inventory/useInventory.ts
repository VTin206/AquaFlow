import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { useStaff } from '@/features/auth/useStaff'
import { catalogApi } from '@/features/live/catalogApi'
import { inventoryApi, receiptCode, type ProductStock, type PurchaseReceipt, type ReceiptInput } from '@/features/live/inventoryApi'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { supplierService } from '@/features/suppliers/supplierService'
import { demoReceiptDrafts } from './demoReceiptDrafts'
import { localToday, vnToIsoDate } from './expiry'
import { productService } from './productService'
import type { Lot, Receipt, ReceiptDraft } from './types'
import { productKeys } from './useProducts'

/**
 * Một nguồn dữ liệu cho trang Kho: bản dùng thử đọc mock, tài khoản thật gọi API BE2.
 * Giao diện chỉ dùng các kiểu bên dưới; phần BE chưa cung cấp thì để trống và `caps` báo để ẩn.
 */
export type StockItem = {
  id: string
  name: string
  sku: string
  brand?: string
  unit?: string
  onHand: number
  reserved: number
  available: number
  expiredOnHand: number
  /** Ngưỡng tồn tối thiểu (ProductController); sản phẩm đã ngừng bán không có. */
  threshold?: number
  /** Hạn gần nhất của lô còn hàng, "yyyy-mm-dd". */
  nearestExpiry?: string
  salePrice?: number
}
export type LotItem = {
  id: string
  productId: string
  productName: string
  lotCode: string
  mfgDate?: string
  expiryDate?: string
  onHand: number
  reserved: number
  available: number
  /** Nguồn nhập: có khi lô đến từ phiếu đã nhập kho. */
  received?: number
  costPrice?: number
  receiptCode?: string
  receivedAt?: string
}
export type ReceiptStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
export type ReceiptLineView = {
  productId: string
  productName: string
  unit?: string
  lotCode?: string
  mfgDate?: string
  expiryDate?: string
  received: number
  damaged: number
  costPrice: number
}
export type ReceiptView = {
  id: string
  code: string
  status: ReceiptStatus
  supplierId: string
  supplierName: string
  receivedAt: string
  receiver?: string
  note?: string
  total: number
  lines: ReceiptLineView[]
}
export type ReceiptForm = Omit<ReceiptDraft, 'receiver'> & { receiver?: string }
export type ReceiptOption = { id: string; name: string; sku: string; unit?: string; onHand: number }

export type InventoryCaps = {
  /** BE bắt buộc mã lô và hạn dùng cho mọi dòng, kể cả vỏ bình. */
  lotAlwaysRequired: boolean
}

const useDemo = () => useAuth().user?.isDemo ?? false

export const useInventoryCaps = (): InventoryCaps => {
  const demo = useDemo()
  return { lotAlwaysRequired: !demo }
}

// ---- Bản dùng thử: chuyển dữ liệu mock sang kiểu chung ----

const demoLot = (lot: Lot, productName: string): LotItem => {
  const expired = Boolean(lot.expiryDate && lot.expiryDate < localToday())
  return {
    id: lot.id,
    productId: lot.productId,
    productName,
    lotCode: lot.lotCode,
    mfgDate: lot.mfgDate,
    expiryDate: lot.expiryDate,
    onHand: lot.remaining,
    reserved: 0,
    available: expired ? 0 : lot.remaining,
    received: lot.received,
    costPrice: lot.costPrice,
    receiptCode: lot.receiptId,
    receivedAt: lot.receivedAt,
  }
}

const demoReceipt = (receipt: Receipt): ReceiptView => ({
  id: receipt.id,
  code: receipt.id,
  status: 'CONFIRMED',
  supplierId: receipt.supplierId,
  supplierName: receipt.supplierName,
  receivedAt: receipt.receivedAt,
  receiver: receipt.receiver,
  note: receipt.note,
  total: receipt.total,
  lines: receipt.lines.map((line) => ({ ...line })),
})

async function demoStock(): Promise<StockItem[]> {
  const [products, lots] = await Promise.all([productService.list(), productService.lots()])
  return products.map((product) => {
    const own = lots.filter((lot) => lot.productId === product.id).map((lot) => demoLot(lot, product.name))
    const expiredOnHand = own.filter((lot) => lot.onHand > 0 && lot.available === 0).reduce((sum, lot) => sum + lot.onHand, 0)
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      brand: product.brand,
      unit: product.unit,
      onHand: product.stock,
      reserved: 0,
      available: Math.max(0, product.stock - expiredOnHand),
      expiredOnHand,
      threshold: product.threshold,
      nearestExpiry: vnToIsoDate(product.expiry),
      salePrice: product.price,
    }
  })
}

async function demoLots(): Promise<LotItem[]> {
  const [products, lots] = await Promise.all([productService.list(), productService.lots()])
  return lots.map((lot) => demoLot(lot, products.find((product) => product.id === lot.productId)?.name ?? lot.productId))
}

// ---- Tài khoản thật: API BE2 ----

const isoDate = (instant: string) => localToday(new Date(instant))
/** Ngày nhận hôm nay gửi giờ hiện tại; ngày trước đó gửi giữa trưa để không lệch ngày khi đổi múi giờ. */
const toInstant = (date: string) => (date === localToday() ? new Date() : new Date(`${date}T12:00:00`)).toISOString()

const liveReceipt = (receipt: PurchaseReceipt): ReceiptView => ({
  id: String(receipt.id),
  code: receiptCode(receipt),
  status: receipt.status,
  supplierId: String(receipt.supplierId),
  supplierName: receipt.supplierName,
  receivedAt: isoDate(receipt.receivedAt),
  receiver: receipt.receiverName ?? undefined,
  note: receipt.note ?? undefined,
  total: receipt.items.reduce((sum, item) => sum + item.quantityAccepted * item.unitCost, 0),
  lines: receipt.items.map((item) => ({
    productId: String(item.productId),
    productName: item.productName,
    lotCode: item.lotCode,
    mfgDate: item.manufacturedOn ?? undefined,
    expiryDate: item.expiresOn,
    received: item.quantityReceived,
    damaged: item.quantityRejected,
    costPrice: item.unitCost,
  })),
})

const liveInput = (form: ReceiptForm): ReceiptInput => ({
  supplierId: Number(form.supplierId),
  receivedAt: toInstant(form.receivedAt),
  note: form.note?.trim() || null,
  receiverName: form.receiver?.trim() || null,
  items: form.lines.map((line) => ({
    productId: Number(line.productId),
    lotCode: line.lotCode?.trim() ?? '',
    manufacturedOn: line.mfgDate || null,
    expiresOn: line.expiryDate ?? '',
    quantityReceived: line.received,
    quantityAccepted: line.received - (line.damaged ?? 0),
    unitCost: line.costPrice,
  })),
})

const nearestExpiry = (stock: ProductStock) =>
  stock.batches
    .filter((batch) => batch.onHand > 0)
    .map((batch) => batch.expiresOn)
    .sort()[0]

/** Ghép tồn kho với danh mục để có cả sản phẩm chưa từng nhập (tồn 0), thương hiệu, đơn vị, giá bán. */
async function liveStock(): Promise<StockItem[]> {
  const [products, stock] = await Promise.all([catalogApi.products(), inventoryApi.stock()])
  const byProduct = new Map(stock.map((item) => [item.productId, item]))
  const rows: StockItem[] = products.map((product) => {
    const item = byProduct.get(product.id)
    byProduct.delete(product.id)
    return {
      id: String(product.id),
      name: product.name,
      sku: product.sku,
      brand: product.brand ?? undefined,
      unit: product.unit,
      onHand: item?.onHand ?? 0,
      reserved: item?.reserved ?? 0,
      available: item?.available ?? 0,
      expiredOnHand: item?.expiredOnHand ?? 0,
      nearestExpiry: item && nearestExpiry(item),
      salePrice: product.salePrice,
      threshold: product.lowStockThreshold,
    }
  })
  // Sản phẩm đã ngừng bán nhưng còn tồn vẫn phải hiện để xử lý.
  for (const item of byProduct.values()) {
    if (item.onHand > 0)
      rows.push({
        id: String(item.productId),
        name: item.productName,
        sku: item.sku,
        onHand: item.onHand,
        reserved: item.reserved,
        available: item.available,
        expiredOnHand: item.expiredOnHand,
        nearestExpiry: nearestExpiry(item),
      })
  }
  return rows
}

/** Lô lấy từ tồn kho; ngày sản xuất, số nhập, giá vốn và phiếu nguồn lấy từ nguồn nhập của lô (BE gộp từ phiếu đã nhập kho). */
async function liveLots(): Promise<LotItem[]> {
  const [stock, sources] = await Promise.all([inventoryApi.stock(), inventoryApi.lotSources()])
  const sourceOf = new Map(sources.map((source) => [source.batchId, source]))
  return stock.flatMap((product) =>
    product.batches.map((batch) => {
      const source = sourceOf.get(batch.batchId)
      return {
        id: String(batch.batchId),
        productId: String(product.productId),
        productName: product.productName,
        lotCode: batch.lotCode,
        mfgDate: source?.manufacturedOn ?? undefined,
        expiryDate: batch.expiresOn,
        onHand: batch.onHand,
        reserved: batch.reserved,
        available: batch.available,
        received: source?.received,
        costPrice: source?.unitCost,
        receiptCode: source && receiptCode({ id: source.receiptId }),
        receivedAt: source && isoDate(source.receivedAt),
      }
    }),
  )
}

// ---- Hook dùng trong giao diện ----

const useLiveKey = () => {
  const staff = useStaff()
  return [staff?.name, staff?.role] as const
}

export function useStockItems(enabled = true) {
  const demo = useDemo()
  const who = useLiveKey()
  return useQuery({
    queryKey: demo ? [...productKeys.all, 'stock-view'] : ['live', 'inventory-stock', ...who],
    queryFn: demo ? demoStock : liveStock,
    enabled,
  })
}

export function useLotItems() {
  const demo = useDemo()
  const who = useLiveKey()
  return useQuery({
    queryKey: demo ? [...productKeys.lots, 'view'] : ['live', 'inventory-lots', ...who],
    queryFn: demo ? demoLots : liveLots,
  })
}

/** Một trang phiếu nhập (ngày nhận mới nhất trước); `statusCounts` đếm trên toàn bộ phiếu, không theo bộ lọc. */
export type ReceiptPageView = { items: ReceiptView[]; total: number; statusCounts: Record<ReceiptStatus, number> }
export type ReceiptPageQuery = { status?: ReceiptStatus; page: number; size: number }

async function demoReceiptPage({ status, page, size }: ReceiptPageQuery): Promise<ReceiptPageView> {
  const all = [...(await demoReceiptDrafts.list()), ...(await productService.receipts()).map(demoReceipt)].sort(
    (a, b) => b.receivedAt.localeCompare(a.receivedAt) || b.id.localeCompare(a.id),
  )
  const matched = status ? all.filter((receipt) => receipt.status === status) : all
  const count = (value: ReceiptStatus) => all.filter((receipt) => receipt.status === value).length
  return {
    items: matched.slice(page * size, page * size + size),
    total: matched.length,
    statusCounts: { DRAFT: count('DRAFT'), CONFIRMED: count('CONFIRMED'), CANCELLED: count('CANCELLED') },
  }
}

export function useReceiptPage(query: ReceiptPageQuery) {
  const demo = useDemo()
  const who = useLiveKey()
  return useQuery({
    queryKey: demo ? [...productKeys.receipts, 'view', query] : ['live', 'receipts', ...who, query],
    queryFn: async (): Promise<ReceiptPageView> => {
      if (demo) return demoReceiptPage(query)
      const page = await inventoryApi.receipts(query)
      return { items: page.items.map(liveReceipt), total: page.total, statusCounts: page.statusCounts }
    },
    placeholderData: keepPreviousData,
  })
}

export function useReceiptOptions() {
  const demo = useDemo()
  const who = useLiveKey()
  const stock = useStockItems()
  const suppliers = useQuery({
    queryKey: demo ? ['suppliers', 'receipt-options'] : ['live', 'receipt-suppliers', ...who],
    queryFn: async () =>
      demo
        ? (await supplierService.list())
            .filter((supplier) => supplier.active)
            .map((supplier) => ({ id: supplier.id, name: `${supplier.name} (${supplier.id})` }))
        : (await catalogApi.suppliers()).map((supplier) => ({ id: String(supplier.id), name: supplier.name })),
  })
  const products: ReceiptOption[] = (stock.data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    unit: item.unit,
    onHand: item.onHand,
  }))
  return {
    products,
    suppliers: suppliers.data ?? [],
    loadingProducts: stock.isPending,
    loadingSuppliers: suppliers.isPending,
    error: stock.error ?? suppliers.error,
    retry: () => {
      void stock.refetch()
      void suppliers.refetch()
    },
  }
}

const useInvalidateInventory = () => {
  const queryClient = useQueryClient()
  return () => Promise.all([invalidateLiveData(queryClient), queryClient.invalidateQueries({ queryKey: productKeys.all })])
}

/** Lưu nháp, và nhập kho luôn nếu `confirm`. */
export function useSaveReceipt() {
  const demo = useDemo()
  const invalidate = useInvalidateInventory()
  return useMutation({
    mutationFn: async ({
      id,
      form,
      confirm,
      onSaved,
    }: {
      id?: string
      form: ReceiptForm
      confirm: boolean
      onSaved?: (id: string) => void
    }): Promise<ReceiptView> => {
      if (demo) {
        if (!confirm) {
          const draft = await demoReceiptDrafts.save(form, id)
          onSaved?.(draft.id)
          return draft
        }
        const confirmed = demoReceipt(await productService.createReceipt({ ...form, receiver: form.receiver ?? '' }))
        if (id !== undefined) demoReceiptDrafts.remove(id)
        return confirmed
      }
      const input = liveInput(form)
      const saved = id === undefined ? await inventoryApi.createReceipt(input) : await inventoryApi.updateReceipt(Number(id), input)
      onSaved?.(String(saved.id))
      return liveReceipt(confirm ? await inventoryApi.confirmReceipt(saved.id) : saved)
    },
    onSettled: () => void invalidate(),
  })
}

/** Xác nhận nhập kho hoặc hủy một phiếu nháp. */
export function useReceiptAction() {
  const demo = useDemo()
  const invalidate = useInvalidateInventory()
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'confirm' | 'cancel' }) => {
      if (demo) {
        if (action === 'cancel') return demoReceiptDrafts.cancel(id)
        const draft = demoReceiptDrafts.get(id)
        if (!draft) throw new Error('Không tìm thấy phiếu nháp.')
        const confirmed = demoReceipt(await productService.createReceipt({ ...receiptToForm(draft), receiver: draft.receiver ?? '' }))
        demoReceiptDrafts.remove(id)
        return confirmed
      }
      return liveReceipt(
        action === 'confirm' ? await inventoryApi.confirmReceipt(Number(id)) : await inventoryApi.cancelReceipt(Number(id)),
      )
    },
    onSettled: () => void invalidate(),
  })
}

/** Phiếu nháp ở dạng form để sửa. */
export const receiptToForm = (receipt: ReceiptView): ReceiptForm => ({
  supplierId: receipt.supplierId,
  receivedAt: receipt.receivedAt,
  receiver: receipt.receiver,
  note: receipt.note,
  lines: receipt.lines.map((line) => ({
    productId: line.productId,
    lotCode: line.lotCode,
    mfgDate: line.mfgDate,
    expiryDate: line.expiryDate,
    received: line.received,
    damaged: line.damaged,
    costPrice: line.costPrice,
  })),
})
