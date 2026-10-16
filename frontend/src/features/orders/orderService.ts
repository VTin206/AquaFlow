import { db } from '../../mocks/db'
import { mockError, mockRequest } from '../../mocks/mockRequest'
import { daysUntilExpiry } from '../inventory/expiry'
import { amountDue, type DeliveryResult, type Order, type OrderDraft, type OrderLine, type PaymentDraft } from './types'

// Bản mô phỏng trong bộ nhớ; API thật cần transaction, phân quyền và nhật ký phía máy chủ.
const now = () => new Date().toISOString()
const findOrder = (id: string) => {
  const order = db.orders.find((item) => item.id === id)
  if (!order) throw mockError(404, 'Không tìm thấy đơn hàng.')
  return order
}
const record = (order: Order, message: string) => order.history.push({ at: now(), message })
const validPhone = (phone: string) => /^(?:0\d{9,10}|\+84\d{9,10})$/.test(phone.replace(/[\s.-]/g, ''))
const priceLines = (lines: OrderDraft['lines']): OrderLine[] => {
  if (!lines?.length) throw mockError(400, 'Đơn phải có ít nhất một sản phẩm.')
  const quantities = new Map<string, number>()
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw mockError(400, 'Số lượng phải là số nguyên dương.')
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity)
  }
  return [...quantities].map(([productId, quantity]) => {
    const product = db.products.find((item) => item.id === productId)
    if (!product || product.sku === 'VO-20L') throw mockError(400, 'Chọn sản phẩm nước đang kinh doanh.')
    if ((daysUntilExpiry(product.expiry) ?? 0) < 0) throw mockError(400, `Sản phẩm ${product.name} đã hết hạn.`)
    if (product.stock < quantity) throw mockError(400, `${product.name}: chỉ còn ${product.stock} ${product.unit.toLowerCase()} có thể bán.`)
    return { productId, quantity, name: product.name, unit: product.unit, unitPrice: product.price }
  })
}
const subtotal = (lines: OrderLine[]) => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
const summary = (lines: OrderLine[]) => lines.map((line) => `${line.quantity} ${line.unit.toLowerCase()} ${line.name}`).join(', ')
const validateAppointment = (appointment?: string) => {
  if (appointment && (!Number.isFinite(Date.parse(appointment)) || Date.parse(appointment) <= Date.now())) {
    throw mockError(400, 'Giờ hẹn phải ở trong tương lai.')
  }
}
const checkExpiry = (order: Order) => {
  for (const line of order.lines) {
    const product = db.products.find((item) => item.id === line.productId)
    if (!product || (daysUntilExpiry(product.expiry) ?? 0) < 0) throw mockError(400, 'Có sản phẩm không còn đủ điều kiện giao. Cần kiểm tra lại hàng.')
  }
}

export const orderService = {
  list: () => mockRequest(() => db.orders),
  create: (draft: OrderDraft) =>
    mockRequest(() => {
      if (!['Tại quầy', 'Giao tận nơi'].includes(draft.method)) throw mockError(400, 'Chọn hình thức nhận hàng.')
      if (!['Tại quầy', 'Điện thoại', 'Tin nhắn', 'Website'].includes(draft.channel)) throw mockError(400, 'Chọn kênh tiếp nhận.')
      const lines = priceLines(draft.lines)
      const delivery = draft.method === 'Giao tận nơi'
      const needsCustomer = delivery || lines.some((line) => line.unit === 'Bình')
      if (needsCustomer && (!draft.customer?.trim() || !draft.phone?.trim()))
        throw mockError(400, 'Cần tên và số điện thoại khi giao hàng hoặc mua bình đổi vỏ.')
      if (draft.phone?.trim() && !validPhone(draft.phone)) throw mockError(400, 'Số điện thoại không hợp lệ.')
      if (delivery && !draft.address?.trim()) throw mockError(400, 'Nhập địa chỉ giao hàng.')
      const deliveryFee = delivery ? draft.deliveryFee : 0
      if (!Number.isSafeInteger(deliveryFee) || deliveryFee < 0) throw mockError(400, 'Phí giao hàng phải là số nguyên không âm.')
      if (delivery) validateAppointment(draft.appointment)
      const id = `AF-${Math.max(1000, ...db.orders.map((order) => Number(order.id.replace('AF-', '')) || 0)) + 1}`
      const order: Order = {
        id,
        customer: draft.customer?.trim() || 'Khách vãng lai',
        phone: draft.phone?.trim() || '',
        address: delivery ? draft.address!.trim() : 'Nhận tại cửa hàng',
        lines,
        items: summary(lines),
        total: subtotal(lines) + deliveryFee,
        deliveryFee,
        method: draft.method,
        channel: draft.channel,
        appointment: delivery ? draft.appointment : undefined,
        note: draft.note?.trim(),
        time: new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
        status: 'Chờ xác nhận',
        payments: [],
        stockReserved: false,
        history: [],
      }
      record(order, 'Tiếp nhận yêu cầu. Giá và tồn kho sẽ được kiểm tra lại khi xác nhận.')
      db.orders.unshift(order)
      return order
    }),

  advanceStatus: (id: string) =>
    mockRequest(() => {
      const order = findOrder(id)
      if (order.status === 'Chờ xác nhận') {
        // Kiểm tra toàn bộ trước khi thay đổi tồn; đơn chờ xác nhận chưa giữ hàng.
        const lines = priceLines(order.lines)
        validateAppointment(order.appointment)
        lines.forEach((line) => {
          db.products.find((product) => product.id === line.productId)!.stock -= line.quantity
        })
        order.lines = lines
        order.items = summary(lines)
        order.total = subtotal(lines) + order.deliveryFee
        order.stockReserved = true
        order.status = 'Đang chuẩn bị'
        record(order, 'Xác nhận đơn, chốt giá và giữ hàng.')
      } else if (order.status === 'Đang chuẩn bị' && order.method === 'Giao tận nơi') {
        checkExpiry(order)
        order.status = 'Đang giao'
        record(order, 'Bắt đầu giao hàng.')
      } else if (order.status === 'Giao thất bại') {
        checkExpiry(order)
        order.status = 'Đang giao'
        record(order, 'Bắt đầu lần giao lại.')
      } else {
        throw mockError(400, 'Đơn không thể chuyển trạng thái bằng thao tác này.')
      }
      return order
    }),

  receive: (id: string, result: DeliveryResult) =>
    mockRequest(() => {
      const order = findOrder(id)
      const counter = order.method === 'Tại quầy' && order.status === 'Đang chuẩn bị'
      if (!counter && order.status !== 'Đang giao') throw mockError(400, 'Đơn chưa sẵn sàng bàn giao.')
      if (!result.success) {
        if (counter || !result.reason?.trim()) throw mockError(400, 'Cần lý do giao hàng thất bại.')
        order.status = 'Giao thất bại'
        record(order, `Giao thất bại: ${result.reason.trim()}`)
      } else {
        if (!counter && !result.receiver?.trim()) throw mockError(400, 'Nhập tên người nhận thực tế.')
        checkExpiry(order)
        order.stockReserved = false
        order.status = amountDue(order) === 0 ? 'Đã hoàn tất' : 'Đã giao'
        record(order, `${counter ? 'Khách nhận tại quầy' : 'Giao thành công'} · Người nhận: ${result.receiver?.trim() || order.customer}`)
      }
      return order
    }),

  pay: (id: string, draft: PaymentDraft) =>
    mockRequest(() => {
      const order = findOrder(id)
      if (['Chờ xác nhận', 'Đã hủy', 'Đã hoàn tất'].includes(order.status)) throw mockError(400, 'Chỉ ghi nhận tiền cho đơn đã xác nhận và còn phải thu.')
      if (!Number.isSafeInteger(draft.amount) || draft.amount <= 0 || draft.amount > amountDue(order))
        throw mockError(400, 'Số tiền phải lớn hơn 0 và không vượt số còn phải thu.')
      if (!['Tiền mặt', 'Chuyển khoản'].includes(draft.method)) throw mockError(400, 'Chọn phương thức thanh toán.')
      if (draft.method === 'Chuyển khoản' && !draft.reference?.trim()) throw mockError(400, 'Nhập mã tham chiếu sau khi kiểm tra chuyển khoản.')
      const reference = draft.method === 'Chuyển khoản' ? draft.reference?.trim() : undefined
      if (reference && db.orders.some((item) => item.payments.some((payment) => payment.reference === reference)))
        throw mockError(400, 'Mã tham chiếu đã được ghi nhận.')
      order.payments.push({ id: `PT-${order.id}-${order.payments.length + 1}`, amount: draft.amount, method: draft.method, reference, recordedAt: now() })
      record(order, `Ghi nhận ${draft.amount.toLocaleString('vi-VN')} ₫ · ${draft.method}`)
      if (order.status === 'Đã giao' && amountDue(order) === 0) order.status = 'Đã hoàn tất'
      return order
    }),

  cancel: (id: string, reason: string) =>
    mockRequest(() => {
      const order = findOrder(id)
      if (!['Chờ xác nhận', 'Đang chuẩn bị'].includes(order.status)) throw mockError(400, 'Chỉ hủy trực tiếp đơn chưa xuất giao.')
      if (order.payments.length) throw mockError(400, 'Đơn đã thu tiền cần xử lý hoàn tiền trước khi hủy.')
      if (!reason.trim()) throw mockError(400, 'Nhập lý do hủy đơn.')
      if (order.stockReserved)
        order.lines.forEach((line) => {
          const product = db.products.find((item) => item.id === line.productId)
          if (product) product.stock += line.quantity
        })
      order.stockReserved = false
      order.status = 'Đã hủy'
      record(order, `Hủy đơn: ${reason.trim()}. Đã giải phóng hàng giữ (nếu có).`)
      return order
    }),
}
