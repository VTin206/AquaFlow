import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useIsDemo } from '@/shared/features'
import { useStaff } from '@/features/auth/useStaff'
import { catalogApi, type CatalogProduct } from '@/features/live/catalogApi'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { channelLabels, orderApi, paymentStatusLabels, type LiveOrder } from '@/features/live/orderApi'
import { orderStatuses } from './orderStatus'
import { walkInName, type Order, type OrderStatus } from './types'
import { useAdvanceOrderStatus, useOrders } from './useOrders'

/**
 * Danh sách đơn cho trang Đơn hàng: bản dùng thử đọc mock, tài khoản thật đọc OrderController
 * và chuyển về kiểu `Order` của giao diện. Phiếu thu, giao hàng, đổi trả BE chưa có nên để trống.
 */
const statusOf: Record<LiveOrder['status'], OrderStatus> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang chuẩn bị',
  OUT_FOR_DELIVERY: 'Đang giao',
  DELIVERED: 'Đã giao',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function fromLiveOrder(order: LiveOrder, products: CatalogProduct[]): Order {
  const lines = order.items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId)
    return {
      productId: String(item.productId),
      name: product?.name ?? `Sản phẩm #${item.productId}`,
      unit: product?.unit ?? '',
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
    }
  })
  return {
    id: String(order.id),
    code: order.orderCode,
    customerId: order.customerId === null ? undefined : String(order.customerId),
    customer: order.recipientName || walkInName,
    phone: order.recipientPhone ?? '',
    address: order.deliveryAddress ?? '',
    area: order.deliveryArea ?? undefined,
    items: lines.map((line) => `${line.name} × ${line.quantity}`).join(', '),
    total: Number(order.total),
    time: timeOf(order.createdAt),
    status: statusOf[order.status],
    method: order.fulfillmentType === 'DELIVERY' ? 'Giao tận nơi' : 'Tại quầy',
    channel: channelLabels[order.channel] as Order['channel'],
    lines,
    deliveryFee: Number(order.deliveryFee),
    appointment: order.requestedDeliveryAt ?? undefined,
    note: order.note ?? undefined,
    payments: [],
    paymentStatusLabel: order.status === 'CANCELLED' ? 'Đã hủy' : paymentStatusLabels[order.paymentStatus],
    history: [{ at: order.createdAt, message: 'Tạo đơn' }],
    stockReserved: ['CONFIRMED', 'PREPARING'].includes(order.status),
  }
}

/** Tên sản phẩm lấy từ danh mục; không tải được thì vẫn hiện đơn với mã sản phẩm. */
async function liveOrders() {
  const [orders, products] = await Promise.all([orderApi.list(), catalogApi.products().catch(() => [])])
  return orders
    .map((order) => fromLiveOrder(order, products))
    .sort((a, b) => (b.history[0]?.at ?? '').localeCompare(a.history[0]?.at ?? ''))
}

/** Trạng thái theo nguồn dữ liệu: mẫu xác nhận là chuyển thẳng sang chuẩn bị; BE có bước "Đã xác nhận" và chưa có "Giao thất bại". */
export function useOrderStatuses() {
  const demo = useIsDemo()
  return orderStatuses.filter((status) => (demo ? status !== 'Đã xác nhận' : status !== 'Giao thất bại'))
}

/** Xác nhận đơn theo nguồn dữ liệu; `refresh` làm mới danh sách sau khi xác nhận xong một loạt. */
export function useConfirmOrderRequest() {
  const demo = useIsDemo()
  const queryClient = useQueryClient()
  const advance = useAdvanceOrderStatus()
  return {
    confirm: (order: Order): Promise<unknown> =>
      demo ? advance.mutateAsync(order.id) : orderApi.updateStatus(Number(order.id), 'CONFIRMED'),
    refresh: () => {
      if (!demo) void invalidateLiveData(queryClient)
    },
  }
}

export function useOrderList(enabled = true) {
  const demo = useIsDemo()
  const staff = useStaff()
  const demoQuery = useOrders(demo && enabled)
  // Đơn mới có thể đến từ website bất cứ lúc nào nên tải lại định kỳ; thẻ trình duyệt ẩn thì tạm dừng.
  const liveQuery = useQuery({
    queryKey: ['live', 'orders-view', staff?.name, staff?.role],
    queryFn: liveOrders,
    enabled: !demo && enabled,
    refetchInterval: 30_000,
  })
  return demo ? demoQuery : liveQuery
}
