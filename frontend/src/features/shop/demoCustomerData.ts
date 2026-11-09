import { customerService } from '@/features/customers/customerService'
import type { Customer } from '@/features/customers/types'
import { numericId } from '@/features/delivery/demoDriverData'
import type { LiveOrder } from '@/features/live/orderApi'
import { orderService } from '@/features/orders/orderService'
import { amountDue, createdAtOf, type Order, type OrderStatus } from '@/features/orders/types'
import type { CustomerProfile, SavedAddress } from './customerAccountApi'

// Bản dùng thử đóng vai một khách mẫu: chuyển dữ liệu mẫu sang đúng kiểu API để dùng chung màn hình khách hàng.

/** Dòng hàng mẫu có sẵn tên, không cần tra danh mục. */
export type CustomerOrder = Omit<LiveOrder, 'items'> & { items: (LiveOrder['items'][number] & { productName?: string })[] }

/** API không có "Giao thất bại": đơn vẫn đang được xử lý giao. */
const statuses: Record<OrderStatus, LiveOrder['status']> = {
  'Chờ xác nhận': 'PENDING',
  'Đã xác nhận': 'CONFIRMED',
  'Đang chuẩn bị': 'PREPARING',
  'Đang giao': 'OUT_FOR_DELIVERY',
  'Đã giao': 'DELIVERED',
  'Giao thất bại': 'OUT_FOR_DELIVERY',
  'Đã hoàn tất': 'COMPLETED',
  'Đã hủy': 'CANCELLED',
}

const placedInThisTab = new Set<string>()

/** Đơn vừa đặt ở cửa hàng bằng bản dùng thử cũng hiện trong "Đơn hàng của tôi". */
export const rememberDemoOrder = (id: string) => {
  placedInThisTab.add(id)
}

/** Khách mẫu là khách có nhiều đơn nhất, để trang có đủ dữ liệu xem. */
async function sampleCustomer(): Promise<Customer> {
  const customers = await customerService.list()
  return customers.reduce((best, item) => (item.orders > best.orders ? item : best))
}

const paymentOf = (order: Order): LiveOrder['paymentStatus'] => {
  const due = amountDue(order)
  return due === 0 ? 'PAID' : due < order.total ? 'PARTIALLY_PAID' : 'UNPAID'
}

export function toCustomerOrder(order: Order, index: number): CustomerOrder {
  const createdAt = createdAtOf(order) ?? new Date().toISOString()
  const subtotal = order.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  return {
    id: numericId(order.id, index + 1),
    orderCode: order.code ?? order.id,
    customerId: null,
    createdBy: null,
    channel: 'WEB',
    fulfillmentType: order.method === 'Tại quầy' ? 'COUNTER' : 'DELIVERY',
    status: statuses[order.status],
    paymentStatus: paymentOf(order),
    recipientName: order.customer,
    recipientPhone: order.phone,
    deliveryAddress: order.address,
    deliveryArea: order.area ?? null,
    requestedDeliveryAt: order.appointment ?? null,
    subtotal,
    discountAmount: order.discount ?? 0,
    deliveryFee: order.deliveryFee,
    total: order.total,
    createdAt,
    confirmedAt: null,
    cancelledAt: null,
    note: order.note ?? null,
    items: order.lines.map((line, lineIndex) => ({
      id: lineIndex + 1,
      productId: numericId(line.productId, lineIndex + 1),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.unitPrice * line.quantity,
      productName: line.name,
    })),
  }
}

async function sampleOrders(): Promise<CustomerOrder[]> {
  const [customer, orders] = await Promise.all([sampleCustomer(), orderService.list()])
  return orders.flatMap((order, index) => (order.customerId === customer.id || placedInThisTab.has(order.id) ? [toCustomerOrder(order, index)] : []))
}

export const demoCustomerOrderApi = {
  list: sampleOrders,
  detail: async (id: number): Promise<CustomerOrder> => {
    const order = (await sampleOrders()).find((item) => item.id === id)
    if (!order) throw new Error('Không tìm thấy đơn hàng mẫu.')
    return order
  },
}

export const demoCustomerAccountApi = {
  profile: async (): Promise<CustomerProfile> => {
    const customer = await sampleCustomer()
    return { fullName: customer.name, email: 'khachmau@aquaflow.vn', phone: customer.phone }
  },
  addresses: async (): Promise<SavedAddress[]> => {
    const customer = await sampleCustomer()
    return customer.addresses.map((addressLine, index) => ({
      id: index + 1,
      customerId: 0,
      recipientName: customer.name,
      recipientPhone: customer.phone,
      addressLine,
      area: customer.area,
      isDefault: index === 0,
    }))
  },
}
