import { db } from '@/mocks/db'
import { mockError, mockRequest } from '@/mocks/mockRequest'
import { asCustomer, logActivity, mockActor, requireRole, type ActivityArea } from '@/mocks/session'
import { addBottleEntry, bottleBalance, ensureCustomer } from '@/features/customers/customerService'
import { suggestedDeliveryFee as webDeliveryFee } from '@/shared/policy'
import { daysUntilExpiry } from '@/features/inventory/expiry'
import {
  amountDue,
  jugCount,
  lateLabel,
  minutesLate,
  paidAmount,
  type DeliveryResult,
  type Order,
  type OrderDraft,
  type OrderLine,
  type PaymentDraft,
  type PublicOrder,
  awaitingReturnInspection,
  returnLinesOf,
  type LotLine,
  type RefundDraft,
  type ReturnDraft,
  type ReturnInspectionDraft,
} from './types'

// Bản mô phỏng trong bộ nhớ; API thật cần transaction, phân quyền và nhật ký phía máy chủ.
const now = () => new Date().toISOString()
const findOrder = (id: string) => {
  const order = db.orders.find((item) => item.id === id)
  if (!order) throw mockError(404, 'Không tìm thấy đơn hàng.')
  return order
}
/** Ghi lịch sử đơn kèm người thao tác, đồng thời thêm vào nhật ký hoạt động chung. */
const record = (order: Order, message: string, area: ActivityArea = 'Đơn hàng') => {
  const at = now()
  order.history.push({ at, message, by: mockActor() })
  logActivity(area, order.id, message, at)
}
const STAFF = ['ADMIN', 'SALES_STAFF'] as const
const restock = (lines: Pick<OrderLine, 'productId' | 'quantity'>[]) =>
  lines.forEach((line) => {
    const product = db.products.find((item) => item.id === line.productId)
    if (product) product.stock += line.quantity
  })
/** Ghi phiếu hoàn tiền; số tiền luôn dương, đánh dấu `refund`. */
function addRefund(order: Order, amount: number, refund: RefundDraft | undefined) {
  if (!refund || !['Tiền mặt', 'Chuyển khoản'].includes(refund.method)) throw mockError(400, 'Chọn cách hoàn tiền cho khách.')
  if (refund.method === 'Chuyển khoản' && !refund.reference?.trim()) throw mockError(400, 'Nhập mã giao dịch hoàn tiền.')
  const count = order.payments.filter((payment) => payment.refund).length + 1
  order.payments.push({
    id: `HT-${order.id}-${count}`,
    amount,
    method: refund.method,
    reference: refund.method === 'Chuyển khoản' ? refund.reference!.trim() : undefined,
    recordedAt: now(),
    refund: true,
    by: mockActor(),
  })
  record(order, `Hoàn ${amount.toLocaleString('vi-VN')} ₫ cho khách · ${refund.method}`, 'Thanh toán')
}
const newTrackingToken = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, '0')).join('')

/** Thông tin khách xem được qua liên kết tra cứu: không lộ lịch sử nội bộ hay người thao tác. */
const toPublicOrder = (order: Order): PublicOrder => ({
  id: order.id,
  customer: order.customer,
  address: order.address,
  status: order.status,
  method: order.method,
  lines: order.lines,
  deliveryFee: order.deliveryFee,
  total: order.total,
  paid: paidAmount(order),
  due: order.status === 'Đã hủy' ? 0 : amountDue(order),
  appointment: order.appointment,
  createdAt: order.history[0]?.at,
  deliveredAt: order.deliveredAt,
  trackingToken: order.trackingToken,
})
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
    if (product.stock < quantity)
      throw mockError(400, `${product.name}: chỉ còn ${product.stock} ${product.unit.toLowerCase()} có thể bán.`)
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
    if (!product || (daysUntilExpiry(product.expiry) ?? 0) < 0)
      throw mockError(400, 'Có sản phẩm không còn đủ điều kiện giao. Cần kiểm tra lại hàng.')
  }
}

/** Hủy được khi hàng chưa tới tay khách: chưa xuất giao, hoặc giao thất bại và đã mang hàng về. */
export const canCancel = (order: Order) => ['Chờ xác nhận', 'Đang chuẩn bị', 'Giao thất bại'].includes(order.status)

/** Số lượng còn có thể nhận trả của một sản phẩm trong đơn. */
export function returnableQuantity(order: Order, productId: string) {
  const sold = order.lines.find((line) => line.productId === productId)?.quantity ?? 0
  const returned = (order.returns ?? [])
    .flatMap((item) => item.lines)
    .filter((line) => line.productId === productId)
    .reduce((sum, line) => sum + line.quantity, 0)
  return sold - returned
}

/** Chỉ đơn giao tận nơi đang chuẩn bị (đã giữ hàng) mới xuất kho đi giao. Đơn giao thất bại phải kiểm hàng hoàn và giao lại trước. */
export const canDispatch = (order: Order) => order.method === 'Giao tận nơi' && order.status === 'Đang chuẩn bị'

/**
 * Lô của phần hàng đang giữ cho đơn. Bản mock suy tồn từng lô theo FEFO từ tổng tồn, nên phần vừa giữ
 * nằm sát ranh giới giữa phần đã dùng và phần còn lại; backend ghi theo lô thật trong transaction.
 */
function dispatchLots(line: OrderLine): LotLine[] {
  const base = { productId: line.productId, name: line.name, unit: line.unit }
  const product = db.products.find((item) => item.id === line.productId)
  const lots = db.lots
    .filter((lot) => lot.productId === line.productId)
    .sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999'))
  if (!product || !lots.length) return [{ ...base, quantity: line.quantity }]
  let consumed = Math.max(0, lots.reduce((sum, lot) => sum + lot.received, 0) - product.stock)
  const used = lots.map((lot) => {
    const take = Math.min(consumed, lot.received)
    consumed -= take
    return take
  })
  const result: LotLine[] = []
  let need = line.quantity
  for (let index = lots.length - 1; index >= 0 && need > 0; index--) {
    const take = Math.min(need, used[index])
    if (!take) continue
    result.unshift({ ...base, lotCode: lots[index].lotCode, expiryDate: lots[index].expiryDate, quantity: take })
    need -= take
  }
  if (need > 0) result.push({ ...base, quantity: need })
  return result
}

/** Xuất kho toàn bộ hàng đã giữ và chuyển đơn sang "Đang giao" (DISPATCH). Không xuất một phần. */
export function beginDelivery(order: Order, via?: string, tripId?: string) {
  if (!canDispatch(order)) throw mockError(400, `Đơn ${order.id} chưa sẵn sàng xuất kho.`)
  checkExpiry(order)
  const retry = Boolean(order.dispatches?.length) || order.history.some((event) => event.message.startsWith('Giao thất bại'))
  order.dispatches = [...(order.dispatches ?? []), { at: now(), by: mockActor(), tripId, lines: order.lines.flatMap(dispatchLots) }]
  // Hàng đã rời kho: không còn là hàng giữ trong kho.
  order.stockReserved = false
  order.status = 'Đang giao'
  record(order, `Xuất kho, ${retry ? 'bắt đầu lần giao lại' : 'bắt đầu giao hàng'}${via ? ` · ${via}` : ''}.`)
}

/** Giữ hàng mới cho lần giao lại sau khi đã kiểm hàng hoàn. */
function reserveAgain(order: Order) {
  for (const line of order.lines) {
    const product = db.products.find((item) => item.id === line.productId)
    if (!product || (daysUntilExpiry(product.expiry) ?? 0) < 0) throw mockError(400, `${line.name} không còn đủ điều kiện giao.`)
    if (product.stock < line.quantity)
      throw mockError(400, `${product.name}: chỉ còn ${product.stock} ${product.unit.toLowerCase()} để giữ cho lần giao lại.`)
  }
  order.lines.forEach((line) => {
    db.products.find((product) => product.id === line.productId)!.stock -= line.quantity
  })
  order.stockReserved = true
  order.status = 'Đang chuẩn bị'
  record(order, 'Giữ hàng mới để giao lại. Lịch sử xuất kho và các lần giao trước được giữ nguyên.')
}

/** Kiểm tra rồi ghi sổ vỏ khi bàn giao; trả về undefined nếu đơn không có vỏ luân chuyển. */
function settleBottles(order: Order, result: DeliveryResult) {
  const delivered = jugCount(order)
  const returned = result.bottlesReturned ?? 0
  const deposit = result.depositCollected ?? 0
  if (!Number.isSafeInteger(returned) || returned < 0) throw mockError(400, 'Số vỏ thu về phải là số nguyên không âm.')
  if (!Number.isSafeInteger(deposit) || deposit < 0) throw mockError(400, 'Tiền cọc phải là số nguyên không âm.')
  if (!delivered && !returned && !deposit) return undefined
  if (!order.customerId) throw mockError(400, 'Đơn chưa gắn hồ sơ khách nên không ghi được vỏ/cọc.')
  const held = bottleBalance(order.customerId).bottles
  if (returned > held + delivered) throw mockError(400, `Khách chỉ có ${held + delivered} vỏ (kể cả vỏ vừa giao).`)
  const base = { customerId: order.customerId, orderId: order.id }
  if (delivered) addBottleEntry({ ...base, kind: 'Giao kèm đơn', bottles: delivered, deposit: 0 })
  if (returned) addBottleEntry({ ...base, kind: 'Thu vỏ', bottles: -returned, deposit: 0 })
  if (deposit) addBottleEntry({ ...base, kind: 'Thu cọc', bottles: 0, deposit })
  return { delivered, returned, deposit }
}

function createOrder(draft: OrderDraft) {
  requireRole(draft.channel === 'Website' ? ['CUSTOMER', ...STAFF] : [...STAFF], 'tạo đơn hàng')
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
  const floor = delivery ? (draft.floor ?? 0) : 0
  if (!Number.isSafeInteger(floor) || floor < 0 || floor > 30) throw mockError(400, 'Số lầu không hợp lệ.')
  const id = `AF-${Math.max(1000, ...db.orders.map((order) => Number(order.id.replace('AF-', '')) || 0)) + 1}`
  // Có tên và số điện thoại thì gắn đơn vào hồ sơ khách (tạo mới nếu chưa có) để theo dõi vỏ, cọc, công nợ.
  const profile =
    draft.customer?.trim() && draft.phone?.trim()
      ? ensureCustomer(draft.customer, draft.phone, delivery ? draft.address?.trim() : undefined)
      : undefined
  const order: Order = {
    id,
    customerId: profile?.id,
    customer: draft.customer?.trim() || 'Khách vãng lai',
    phone: draft.phone?.trim() || '',
    address: delivery ? draft.address!.trim() : 'Nhận tại cửa hàng',
    lines,
    items: summary(lines),
    total: subtotal(lines) + deliveryFee,
    deliveryFee,
    floor: floor || undefined,
    method: draft.method,
    channel: draft.channel,
    appointment: delivery ? draft.appointment : undefined,
    note: draft.note?.trim(),
    time: new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
    status: 'Chờ xác nhận',
    payments: [],
    stockReserved: false,
    history: [],
    trackingToken: newTrackingToken(),
  }
  record(
    order,
    `${draft.channel === 'Website' ? 'Khách đặt qua website' : 'Tiếp nhận yêu cầu'}. Giá và tồn kho sẽ được kiểm tra lại khi xác nhận.`,
  )
  db.orders.unshift(order)
  return order
}

export const orderService = {
  list: () => mockRequest(() => db.orders),
  create: (draft: OrderDraft) => mockRequest(() => createOrder(draft)),

  advanceStatus: (id: string) =>
    mockRequest(() => {
      const order = findOrder(id)
      if (order.status === 'Chờ xác nhận') {
        requireRole([...STAFF], 'xác nhận đơn')
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
        requireRole([...STAFF], 'xuất kho')
        beginDelivery(order)
      } else if (order.status === 'Giao thất bại') {
        requireRole([...STAFF], 'tạo lần giao lại')
        if (awaitingReturnInspection(order)) throw mockError(400, 'Kiểm hàng mang về trước khi giao lại.')
        reserveAgain(order)
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
        const bottles = settleBottles(order, result)
        order.stockReserved = false
        order.deliveredAt = now()
        order.status = amountDue(order) === 0 ? 'Đã hoàn tất' : 'Đã giao'
        if (bottles) {
          order.bottles = bottles
          record(
            order,
            `Vỏ: giao ${bottles.delivered}, thu về ${bottles.returned}${bottles.deposit ? ` · Thu cọc ${bottles.deposit.toLocaleString('vi-VN')} ₫ (ghi sổ cọc, không tính doanh thu)` : ''}`,
          )
        }
        const late = minutesLate(order)
        record(
          order,
          `${counter ? 'Khách nhận tại quầy' : 'Giao thành công'} · Người nhận: ${result.receiver?.trim() || order.customer}${late ? ` · Trễ ${lateLabel(late)} so với giờ hẹn` : ''}`,
        )
      }
      return order
    }),

  pay: (id: string, draft: PaymentDraft) =>
    mockRequest(() => {
      const order = findOrder(id)
      if (['Chờ xác nhận', 'Đã hủy', 'Đã hoàn tất'].includes(order.status))
        throw mockError(400, 'Chỉ ghi nhận tiền cho đơn đã xác nhận và còn phải thu.')
      if (!Number.isSafeInteger(draft.amount) || draft.amount <= 0 || draft.amount > amountDue(order))
        throw mockError(400, 'Số tiền phải lớn hơn 0 và không vượt số còn phải thu.')
      if (!['Tiền mặt', 'Chuyển khoản'].includes(draft.method)) throw mockError(400, 'Chọn phương thức thanh toán.')
      if (draft.method === 'Chuyển khoản' && !draft.reference?.trim())
        throw mockError(400, 'Nhập mã tham chiếu sau khi kiểm tra chuyển khoản.')
      const reference = draft.method === 'Chuyển khoản' ? draft.reference?.trim() : undefined
      if (reference && db.orders.some((item) => item.payments.some((payment) => payment.reference === reference)))
        throw mockError(400, 'Mã tham chiếu đã được ghi nhận.')
      const count = order.payments.filter((payment) => !payment.refund).length + 1
      order.payments.push({
        id: `PT-${order.id}-${count}`,
        amount: draft.amount,
        method: draft.method,
        reference,
        recordedAt: now(),
        by: mockActor(),
      })
      record(order, `Ghi nhận ${draft.amount.toLocaleString('vi-VN')} ₫ · ${draft.method}`, 'Thanh toán')
      if (order.status === 'Đã giao' && amountDue(order) === 0) order.status = 'Đã hoàn tất'
      return order
    }),

  /** Hủy đơn chưa tới tay khách. Đơn giao thất bại coi như hàng đã về cửa hàng. Đã thu tiền thì hoàn hết trong cùng thao tác. */
  cancel: (id: string, reason: string, refund?: RefundDraft) =>
    mockRequest(() => {
      const order = findOrder(id)
      requireRole([...STAFF], 'hủy đơn')
      if (order.status === 'Đang giao')
        throw mockError(400, 'Đơn đang trên đường giao. Ghi kết quả giao thất bại (hàng mang về) rồi mới hủy.')
      if (!canCancel(order)) throw mockError(400, 'Đơn đã giao cho khách; dùng chức năng nhận trả hàng.')
      if (awaitingReturnInspection(order)) throw mockError(400, 'Kiểm hàng mang về trước khi hủy đơn.')
      if (!reason.trim()) throw mockError(400, 'Nhập lý do hủy đơn.')
      const paid = paidAmount(order)
      if (paid > 0) {
        requireRole(['ADMIN'], 'hoàn tiền')
        addRefund(order, paid, refund)
      }
      const returned = order.status === 'Giao thất bại'
      if (order.stockReserved) restock(order.lines)
      order.stockReserved = false
      order.status = 'Đã hủy'
      record(
        order,
        `Hủy đơn: ${reason.trim()}. ${returned ? 'Hàng mang về đã xử lý khi kiểm hàng hoàn.' : 'Đã giải phóng hàng giữ (nếu có).'}`,
      )
      return order
    }),

  /** Kiểm hàng mang về sau khi giao thất bại: nhập lại phần bán được (RETURN), phần hỏng loại khỏi kho. */
  inspectReturn: (id: string, draft: ReturnInspectionDraft) =>
    mockRequest(() => {
      const order = findOrder(id)
      requireRole([...STAFF], 'tiếp nhận hàng hoàn')
      if (!awaitingReturnInspection(order)) throw mockError(400, 'Đơn không có hàng chờ kiểm.')
      const lines = returnLinesOf(order)
      if (draft.sellable?.length !== lines.length) throw mockError(400, 'Nhập số lượng đạt cho từng dòng hàng.')
      const checked = lines.map((line, index) => {
        const sellable = draft.sellable[index]
        if (!Number.isSafeInteger(sellable) || sellable < 0 || sellable > line.quantity)
          throw mockError(400, `${line.name}: số đạt phải từ 0 đến ${line.quantity}.`)
        return { ...line, sellable, damaged: line.quantity - sellable }
      })
      const damaged = checked.reduce((sum, line) => sum + line.damaged, 0)
      if (damaged && !draft.note?.trim()) throw mockError(400, 'Ghi chú tình trạng hàng hỏng.')
      restock(checked.map((line) => ({ productId: line.productId, quantity: line.sellable })))
      order.stockReserved = false
      order.returnInspections = [
        ...(order.returnInspections ?? []),
        { at: now(), by: mockActor(), note: draft.note?.trim() || undefined, lines: checked },
      ]
      const sellable = checked.reduce((sum, line) => sum + line.sellable, 0)
      record(
        order,
        `Kiểm hàng hoàn: nhập lại ${sellable}, hỏng ${damaged}${draft.note?.trim() ? ` · ${draft.note.trim()}` : ''}.`,
        'Kho hàng',
      )
      return order
    }),

  /** Khách trả một phần hoặc toàn bộ hàng đã nhận; giảm giá trị đơn và hoàn phần đã thu vượt. */
  returnItems: (id: string, draft: ReturnDraft) =>
    mockRequest(() => {
      const order = findOrder(id)
      requireRole(['ADMIN'], 'nhận trả hàng')
      if (!['Đã giao', 'Đã hoàn tất'].includes(order.status)) throw mockError(400, 'Chỉ nhận trả hàng với đơn khách đã nhận.')
      if (!draft.reason?.trim()) throw mockError(400, 'Nhập lý do trả hàng.')
      const lines = (draft.lines ?? []).filter((line) => line.quantity > 0)
      if (!lines.length) throw mockError(400, 'Chọn ít nhất một sản phẩm trả lại.')
      const returnedLines: OrderLine[] = lines.map((line) => {
        const sold = order.lines.find((item) => item.productId === line.productId)
        if (!sold) throw mockError(400, 'Sản phẩm trả không có trong đơn.')
        if (!Number.isSafeInteger(line.quantity)) throw mockError(400, 'Số lượng trả phải là số nguyên.')
        const left = returnableQuantity(order, line.productId)
        if (line.quantity > left) throw mockError(400, `${sold.name}: chỉ còn ${left} có thể trả.`)
        return { ...sold, quantity: line.quantity }
      })
      const value = returnedLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
      const refundDue = Math.max(0, paidAmount(order) - (order.total - value))
      // Kiểm tra cách hoàn tiền trước khi đổi dữ liệu để không trả hàng dở dang.
      if (refundDue > 0 && (!draft.refundMethod || (draft.refundMethod === 'Chuyển khoản' && !draft.refundReference?.trim())))
        throw mockError(400, `Cần hoàn ${refundDue.toLocaleString('vi-VN')} ₫: chọn cách hoàn tiền.`)
      order.total -= value
      if (refundDue > 0) addRefund(order, refundDue, { method: draft.refundMethod!, reference: draft.refundReference })
      if (draft.restock) restock(returnedLines)
      const entry = {
        id: `TH-${order.id}-${(order.returns?.length ?? 0) + 1}`,
        at: now(),
        by: mockActor(),
        lines: returnedLines,
        reason: draft.reason.trim(),
        restocked: Boolean(draft.restock),
        refunded: refundDue,
      }
      order.returns = [...(order.returns ?? []), entry]
      record(
        order,
        `Nhận trả ${summary(returnedLines)} (${value.toLocaleString('vi-VN')} ₫): ${entry.reason}. ${draft.restock ? 'Đã nhập lại tồn bán được.' : 'Hàng hỏng, loại khỏi kho.'}`,
      )
      if (order.status === 'Đã giao' && amountDue(order) === 0) order.status = 'Đã hoàn tất'
      return order
    }),

  /** Khách đặt trên website, không cần tài khoản; luôn giao tận nơi. */
  placeWebOrder: (draft: Omit<OrderDraft, 'channel' | 'method' | 'deliveryFee'>) =>
    mockRequest(() => {
      // Phí giao tính theo chính sách ở phía cửa hàng, khách không tự nhập.
      const units = (draft.lines ?? []).reduce((sum, line) => sum + line.quantity, 0)
      const jugs = (draft.lines ?? [])
        .filter((line) => db.products.find((product) => product.id === line.productId)?.unit === 'Bình')
        .reduce((sum, line) => sum + line.quantity, 0)
      const deliveryFee = webDeliveryFee({ units, jugs, floor: draft.floor ?? 0 })
      return toPublicOrder(
        asCustomer(draft.customer?.trim() || 'Khách', () =>
          createOrder({ ...draft, deliveryFee, channel: 'Website', method: 'Giao tận nơi' }),
        ),
      )
    }),

  /** Tra cứu bằng liên kết riêng, hoặc mã đơn kèm số điện thoại đặt hàng. */
  track: (lookup: { token: string } | { id: string; phone: string }) =>
    mockRequest(() => {
      const digits = (value: string) => value.replace(/\D/g, '')
      const order =
        'token' in lookup
          ? db.orders.find((item) => item.trackingToken && item.trackingToken === lookup.token)
          : db.orders.find(
              (item) => item.id === lookup.id.trim().toUpperCase() && item.phone && digits(item.phone) === digits(lookup.phone),
            )
      if (!order) throw mockError(404, 'Không tìm thấy đơn. Kiểm tra lại mã đơn và số điện thoại.')
      return toPublicOrder(order)
    }),
}
