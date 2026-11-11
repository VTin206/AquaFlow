import { useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useIsDemo } from '@/shared/features'
import { useStaff } from '@/features/auth/useStaff'
import { catalogApi, type CatalogProduct } from '@/features/live/catalogApi'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import {
  channelLabels,
  orderApi,
  paymentStatusLabels,
  type LiveOrder,
  type LiveOrderListItem,
  type OrderPage,
  type OrderPageQuery,
} from '@/features/live/orderApi'
import { matchesSearch } from '@/shared/utils/search'
import { amountDue, createdAtOf, walkInName, type Order, type OrderStatus } from './types'
import { useAdvanceOrderStatus, useOrders } from './useOrders'
import type { OrderBalance } from '@/features/live/paymentApi'
import { inOrderGroup, statusesInGroup, type OrderGroupKey } from './orderGroups'
import { orderStatuses } from './orderStatus'
import { ALL_ORDERS } from './useOrderFilters'

/**
 * Danh sách đơn cho trang Đơn hàng: bản dùng thử đọc mock, tài khoản thật đọc OrderController
 * và chuyển về kiểu `Order` của giao diện. Lịch sử giao và Dispatch tải riêng trong chi tiết đơn.
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

export function fromLiveOrder(
  order: LiveOrder,
  products: CatalogProduct[],
  balance?: Pick<OrderBalance, 'paid' | 'due' | 'refundDue'>,
): Order {
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
    discount: Number(order.discountAmount) || undefined,
    appointment: order.requestedDeliveryAt ?? undefined,
    note: order.note ?? undefined,
    payments: [],
    paymentBalance: balance ? { paid: Number(balance.paid), due: Number(balance.due), refundDue: Number(balance.refundDue) } : undefined,
    paymentStatusLabel: order.status === 'CANCELLED' && order.paymentStatus === 'UNPAID' ? 'Đã hủy' : paymentStatusLabels[order.paymentStatus],
    history: [{ at: order.createdAt, message: 'Tạo đơn' }],
    stockReserved: ['CONFIRMED', 'PREPARING'].includes(order.status),
  }
}

/** Tên sản phẩm lấy từ danh mục; không tải được thì vẫn hiện đơn với mã sản phẩm. BE trả sẵn thứ tự mới nhất trước và số dư từng đơn. */
async function toOrders(load: Promise<LiveOrderListItem[]>) {
  const [orders, products] = await Promise.all([load, catalogApi.products().catch(() => [])])
  return orders.map((order) => fromLiveOrder(order, products, order))
}

/** Đơn còn việc phải làm cộng đơn tạo trong 30 ngày gần nhất: đủ cho các màn hình vận hành, không phụ thuộc số đơn lịch sử. */
const liveOrders = () => toOrders(orderApi.workingSet())

const statusOfLabel = Object.fromEntries(Object.entries(statusOf).map(([live, label]) => [label, live])) as Partial<
  Record<OrderStatus, LiveOrder['status']>
>

/** Bộ lọc trang Đơn hàng sau khi đã chọn nhóm (không còn nhóm rỗng). */
export type OrderListFilters = { query: string; group: OrderGroupKey; status: string; method: string; payment: string }

/** Cùng quy tắc với BE; dùng cho bản dùng thử, nơi đơn mẫu được lọc ngay trong trình duyệt. */
export function matchesOrderFilters(order: Order, { query, group, status, method, payment }: OrderListFilters) {
  return (
    inOrderGroup(group, order.status) &&
    (status === ALL_ORDERS || order.status === status) &&
    (method === ALL_ORDERS || order.method === method) &&
    (payment === ALL_ORDERS ||
      (order.status !== 'Đã hủy' && (payment === 'Còn phải thu' ? amountDue(order) > 0 : amountDue(order) === 0))) &&
    matchesSearch(query, `${order.code ?? order.id} ${order.customer} ${order.phone} ${order.items}`, order.phone)
  )
}

/**
 * Đổi bộ lọc giao diện sang tham số GET /sales/orders. `null` khi chắc chắn không có đơn nào
 * (ví dụ chỉ chọn "Giao thất bại", trạng thái BE chưa có), để không gửi yêu cầu "không lọc".
 */
export function toOrderPageQuery(filters: OrderListFilters, page: number, size: number): OrderPageQuery | null {
  const wanted = filters.status === ALL_ORDERS ? statusesInGroup(filters.group, orderStatuses) : [filters.status as OrderStatus]
  const statuses = wanted.flatMap((label) => statusOfLabel[label] ?? [])
  if (filters.group !== 'all' || filters.status !== ALL_ORDERS) {
    if (statuses.length === 0) return null
  }
  return {
    page,
    size,
    statuses: filters.group === 'all' && filters.status === ALL_ORDERS ? undefined : statuses,
    fulfillment: filters.method === 'Tại quầy' ? 'COUNTER' : filters.method === 'Giao tận nơi' ? 'DELIVERY' : undefined,
    payment: filters.payment === 'Còn phải thu' ? 'DUE' : filters.payment === 'Đã thanh toán' ? 'SETTLED' : undefined,
    q: filters.query,
  }
}

/**
 * Dữ liệu trang Đơn hàng. `serverPaged`: `orders` là một trang BE trả về (lịch sử, mới nhất trước);
 * ngược lại `orders` là mọi đơn khớp bộ lọc để bảng tự sắp xếp và phân trang.
 */
export type OrderPageView = { orders: Order[]; total: number; serverPaged: boolean }

/**
 * Nhóm "Cần xử lý" và "Đang thực hiện" chỉ gồm đơn chưa xong, luôn nằm trọn trong tập đơn đang xử lý,
 * nên vẫn lọc/sắp xếp (giao sớm nhất trước) ngay trong trình duyệt. Hai nhóm lịch sử mới phân trang ở BE.
 */
export const isServerPagedGroup = (group: OrderGroupKey) => group === 'done' || group === 'all'

const countByStatus = (orders: Order[]) =>
  orders.reduce<Partial<Record<OrderStatus, number>>>((counts, order) => ({ ...counts, [order.status]: (counts[order.status] ?? 0) + 1 }), {})

const toStatusCounts = (counts: OrderPage['statusCounts']) =>
  Object.fromEntries(
    Object.entries(counts).map(([live, count]) => [statusOf[live as LiveOrder['status']], count]),
  ) as Partial<Record<OrderStatus, number>>

type StatusCounts = Partial<Record<OrderStatus, number>>

/**
 * Số đơn theo trạng thái trên mọi đơn, cho nhãn nhóm và ô chọn trạng thái của trang Đơn hàng.
 * Tài khoản thật lấy từ BE (một trang 1 đơn kèm `statusCounts`); bản dùng thử đếm đơn mẫu.
 */
export function useOrderStatusCounts() {
  const demo = useIsDemo()
  const staff = useStaff()
  const demoOrders = useOrders(demo)
  const live = useQuery({
    queryKey: ['live', 'orders-page', staff?.name, staff?.role, 'status-counts'],
    queryFn: () => orderApi.page({ page: 0, size: 1 }).then((result) => toStatusCounts(result.statusCounts)),
    enabled: !demo,
    refetchInterval: 30_000,
  })
  const demoCounts = useMemo(() => demoOrders.data && countByStatus(demoOrders.data), [demoOrders.data])
  return demo ? { ...demoOrders, data: demoCounts as StatusCounts | undefined } : live
}

/** Một trang đơn từ BE; `null` khi bộ lọc chắc chắn rỗng. */
async function liveOrderPage(query: OrderPageQuery | null): Promise<Pick<OrderPageView, 'orders' | 'total'>> {
  if (!query) return { orders: [], total: 0 }
  const result = await orderApi.page(query)
  return { orders: await toOrders(Promise.resolve(result.items)), total: result.total }
}

export type OrderPageResult = {
  data: Omit<OrderPageView, 'statusCounts'> | undefined
  isPending: boolean
  isError: boolean
  error: Error | null
  refetch: () => unknown
}

/**
 * Danh sách trên trang Đơn hàng. Tài khoản thật: nhóm lịch sử lọc/tìm/phân trang ở BE (giữ trang cũ trong lúc
 * tải trang mới); nhóm việc cần làm lọc trên tập đơn đang xử lý. Bản dùng thử lọc toàn bộ đơn mẫu trong trình duyệt.
 */
export function useOrderPage(filters: OrderListFilters, page: number, size: number): OrderPageResult {
  const demo = useIsDemo()
  const staff = useStaff()
  const serverPaged = !demo && isServerPagedGroup(filters.group)
  const working = useOrderList(!serverPaged)
  const query = toOrderPageQuery(filters, page, size)
  const live = useQuery({
    queryKey: ['live', 'orders-page', staff?.name, staff?.role, query, filters.status],
    queryFn: () => liveOrderPage(query),
    enabled: serverPaged,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
  const filtered = useMemo(
    () => (working.data ? working.data.filter((order) => matchesOrderFilters(order, filters)) : undefined),
    [working.data, filters],
  )

  if (serverPaged) {
    return {
      data: live.data && { ...live.data, serverPaged: true },
      isPending: live.isPending,
      isError: live.isError,
      error: live.error,
      refetch: live.refetch,
    }
  }
  return {
    data: filtered && { orders: filtered, total: filtered.length, serverPaged: false },
    isPending: working.isPending,
    isError: working.isError,
    error: working.error,
    refetch: working.refetch,
  }
}

/** Toàn bộ lịch sử đơn của một khách (hồ sơ khách), mới nhất trước. */
export function useCustomerOrders(customerId: string | undefined) {
  const demo = useIsDemo()
  const staff = useStaff()
  const demoOrders = useOrders(demo && Boolean(customerId))
  const live = useQuery({
    queryKey: ['live', 'orders-view', staff?.name, staff?.role, 'customer', customerId],
    queryFn: () => toOrders(orderApi.byCustomer(Number(customerId))),
    enabled: !demo && Boolean(customerId),
  })
  const demoData = useMemo(
    () =>
      demoOrders.data
        ?.filter((order) => order.customerId === customerId)
        .sort((a, b) => (createdAtOf(b) ?? '').localeCompare(createdAtOf(a) ?? '')),
    [demoOrders.data, customerId],
  )
  return demo ? { ...demoOrders, data: demoData } : live
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
