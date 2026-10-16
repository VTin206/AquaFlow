import { db } from '../../mocks/db'
import { mockError, mockRequest } from '../../mocks/mockRequest'
import { nextStatus } from './orderStatus'
import type { Order, OrderDraft } from './types'

// Đang dùng dữ liệu mẫu. Khi backend có API, thay thân từng hàm bằng lệnh gọi tương ứng,
// ví dụ `list: () => api.get<Order[]>('/orders')`; giao diện không cần sửa.

const nextOrderId = () => {
  const max = Math.max(1000, ...db.orders.map((order) => Number(order.id.replace('AF-', '')) || 0))
  return `AF-${max + 1}`
}

export const orderService = {
  list: () => mockRequest(() => db.orders),

  create: (draft: OrderDraft) =>
    mockRequest(() => {
      const product = db.products.find((item) => item.id === draft.productId)
      if (!product) throw mockError(404, 'Không tìm thấy sản phẩm.')
      if (product.stock < draft.quantity) throw mockError(400, `Tồn kho không đủ: chỉ còn ${product.stock} ${product.unit.toLowerCase()}.`)

      const order: Order = {
        id: nextOrderId(),
        customer: draft.customer.trim(),
        phone: 'Chưa cập nhật',
        address: 'Chưa có địa chỉ giao hàng',
        items: `${draft.quantity} ${product.unit.toLowerCase()} ${product.name}`,
        total: product.price * draft.quantity,
        time: new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
        status: 'Chờ xác nhận',
        method: 'Giao tận nơi',
      }
      product.stock -= draft.quantity
      db.orders.unshift(order)
      return order
    }),

  advanceStatus: (id: string) =>
    mockRequest(() => {
      const order = db.orders.find((item) => item.id === id)
      if (!order) throw mockError(404, `Không tìm thấy đơn ${id}.`)
      order.status = nextStatus[order.status]
      return order
    }),
}
