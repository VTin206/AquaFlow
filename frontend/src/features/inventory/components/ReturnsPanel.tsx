import { useIsDemo } from '@/shared/features'
import { InspectionModal, LiveReturnsPanel } from './LiveReturnsPanel'
import { useState } from 'react'
import { awaitingReturnInspection, deliveryAttempts, returnLinesOf, type Order } from '@/features/orders/types'
import { useOrderAction, useOrders } from '@/features/orders/useOrders'
import { ReturnsView, type ReturnHistoryRow } from './ReturnsView'

/** Đơn giao thất bại có hàng mang về: kiểm từng lô trước khi nhập lại kho. */
export function ReturnsPanel() {
  return useIsDemo() ? <DemoReturnsPanel /> : <LiveReturnsPanel />
}

function DemoReturnsPanel() {
  const ordersQuery = useOrders()
  const action = useOrderAction()
  const [orderId, setOrderId] = useState<string | null>(null)
  const orders = ordersQuery.data ?? []
  const pending = orders.filter(awaitingReturnInspection)
  const order = pending.find((item) => item.id === orderId)
  const history = orders.flatMap((item) =>
    (item.returnInspections ?? []).map((inspection, index): ReturnHistoryRow => ({
      id: `${item.id}-${index + 1}`,
      orderCode: item.code ?? item.id,
      createdAt: inspection.at,
      note: inspection.note,
      lines: inspection.lines.map((line, lineIndex) => ({
        key: `${line.productId}-${lineIndex}`,
        productName: line.name,
        lotCode: line.lotCode,
        quantity: line.quantity,
        sellable: line.sellable,
      })),
    })),
  )

  return (
    <ReturnsView
      pending={pending.map((item) => ({
        key: item.id,
        orderCode: item.code ?? item.id,
        recipient: item.customer,
        reason:
          deliveryAttempts(item)
            .filter((attempt) => !attempt.success)
            .at(-1)?.reason ?? null,
        goods: returnLinesOf(item)
          .map((line) => `${line.quantity} × ${line.name}`)
          .join(', '),
      }))}
      pendingLoading={ordersQuery.isPending}
      onInspect={(row) => setOrderId(String(row.key))}
      history={history}
      historyLoading={ordersQuery.isPending}
    >
      {order && (
        <InspectionModal
          key={order.id}
          order={toInspection(order)}
          partial={false}
          onSave={({ lines, note }) =>
            action.mutateAsync({
              kind: 'inspectReturn',
              id: order.id,
              draft: { sellable: returnLinesOf(order).map((_, index) => lines.find((line) => line.loadItemId === index)?.sellable ?? 0), note },
            })
          }
          onClose={() => setOrderId(null)}
        />
      )}
    </ReturnsView>
  )
}

const toInspection = (order: Order) => ({
  orderCode: order.code ?? order.id,
  lines: returnLinesOf(order).map((line, index) => ({
    loadItemId: index,
    batchId: 0,
    productName: line.name,
    lotCode: line.lotCode ?? '—',
    expiresOn: line.expiryDate ?? '',
    quantity: line.quantity,
    sellable: null,
  })),
})
