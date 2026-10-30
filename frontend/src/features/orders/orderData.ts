import { useQuery } from '@tanstack/react-query'
import { useIsDemo } from '../../shared/features'
import { useStaff } from '../auth/useStaff'
import { catalogApi, type CatalogProduct } from '../live/catalogApi'
import { channelLabels, orderApi, paymentStatusLabels, type LiveOrder } from '../live/orderApi'
import type { Order, OrderStatus } from './types'
import { useOrders } from './useOrders'

/**
 * Danh sách đơn cho trang Đơn hàng: bản dùng thử đọc mock, tài khoản thật đọc OrderController
 * và chuyển về kiểu `Order` của giao diện. Phiếu thu, giao hàng, đổi trả BE chưa có nên để trống.
 */
const statusOf: Record<LiveOrder['status'], OrderStatus> = {
  PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', PREPARING: 'Đang chuẩn bị', OUT_FOR_DELIVERY: 'Đang giao',
  DELIVERED: 'Đã giao', COMPLETED: 'Đã hoàn tất', CANCELLED: 'Đã hủy',
}

const timeOf = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function fromLiveOrder(order: LiveOrder, products: CatalogProduct[]): Order {
  const lines = order.items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId)
    return { productId: String(item.productId), name: product?.name ?? `Sản phẩm #${item.productId}`, unit: product?.unit ?? '', quantity: item.quantity, unitPrice: Number(item.unitPrice) }
  })
  return {
    id: String(order.id),
    code: order.orderCode,
    customerId: order.customerId === null ? undefined : String(order.customerId),
    customer: order.recipientName || 'Khách tại quầy',
    phone: order.recipientPhone ?? '',
    address: order.deliveryAddress ?? '',
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
    stockReserved: ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'].includes(order.status),
  }
}

/** Tên sản phẩm lấy từ danh mục; không tải được thì vẫn hiện đơn với mã sản phẩm. */
async function liveOrders() {
  const [orders, products] = await Promise.all([orderApi.list(), catalogApi.products().catch(() => [])])
  return orders.map((order) => fromLiveOrder(order, products)).sort((a, b) => (b.history[0]?.at ?? '').localeCompare(a.history[0]?.at ?? ''))
}

export function useOrderList() {
  const demo = useIsDemo()
  const staff = useStaff()
  const demoQuery = useOrders(demo)
  const liveQuery = useQuery({ queryKey: ['live', 'orders-view', staff?.name, staff?.role], queryFn: liveOrders, enabled: !demo })
  return demo ? demoQuery : liveQuery
}
