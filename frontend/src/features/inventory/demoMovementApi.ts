import { numericId } from '@/features/delivery/demoDriverData'
import type { InventoryMovement, MovementFilter, MovementPage } from '@/features/live/movementApi'
import { orderService } from '@/features/orders/orderService'
import type { Order } from '@/features/orders/types'

// Suy biến động kho từ các lần xuất giao và kiểm hàng hoàn của đơn mẫu, trả về đúng kiểu của API.

const base = (order: Order) => ({
  productId: 0,
  sku: '',
  batchId: 0,
  referenceType: 'ORDER' as const,
  referenceId: numericId(order.id, 0),
  referenceCode: order.code ?? order.id,
  orderRef: order.id,
  performedBy: 0,
})

const movementsOf = (orders: Order[]): InventoryMovement[] =>
  orders
    .flatMap((order) => [
      ...(order.dispatches ?? []).flatMap((dispatch) =>
        dispatch.lines.map((line) => ({
          ...base(order),
          id: 0,
          type: 'DISPATCH' as const,
          quantity: line.quantity,
          signedQuantity: -line.quantity,
          occurredAt: dispatch.at,
          productName: line.name,
          unit: line.unit,
          lotCode: line.lotCode ?? '—',
          expiresOn: line.expiryDate ?? '',
          performedByName: dispatch.by ?? '—',
          reason: dispatch.tripId ? `Chuyến ${dispatch.tripId}` : null,
        })),
      ),
      ...(order.returnInspections ?? []).flatMap((inspection) =>
        inspection.lines.map((line) => ({
          ...base(order),
          id: 0,
          type: 'RETURN' as const,
          quantity: line.sellable,
          signedQuantity: line.sellable,
          occurredAt: inspection.at,
          productName: line.name,
          unit: line.unit,
          lotCode: line.lotCode ?? '—',
          expiresOn: line.expiryDate ?? '',
          performedByName: inspection.by ?? '—',
          reason: line.damaged ? `Hỏng ${line.damaged}${inspection.note ? ` · ${inspection.note}` : ''}` : (inspection.note ?? null),
        })),
      ),
    ])
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((movement, index) => ({ ...movement, id: index + 1 }))

const load = async () => movementsOf(await orderService.list())

const matches = (row: InventoryMovement, { type, from, to, q }: MovementFilter) => {
  const text = q?.toLowerCase()
  return (
    (!type || row.type === type) &&
    (!from || row.occurredAt >= from) &&
    (!to || row.occurredAt < to) &&
    (!text || [row.productName, row.lotCode, row.referenceCode, row.performedByName].some((value) => value.toLowerCase().includes(text)))
  )
}

export const demoMovementApi = {
  list: async (filter: MovementFilter): Promise<MovementPage> => {
    const rows = (await load()).filter((row) => matches(row, filter))
    return { content: rows.slice(filter.page * filter.size, (filter.page + 1) * filter.size), page: filter.page, size: filter.size, totalElements: rows.length }
  },
  detail: async (id: number): Promise<InventoryMovement> => {
    const row = (await load()).find((item) => item.id === id)
    if (!row) throw new Error('Không tìm thấy giao dịch kho.')
    return row
  },
}
