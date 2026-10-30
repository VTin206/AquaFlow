import { db } from '../../mocks/db'
import { mockError, mockRequest } from '../../mocks/mockRequest'
import { logActivity, mockActor, requireRole } from '../../mocks/session'
import { beginDelivery, canDispatch } from '../orders/orderService'
import type { Order } from '../orders/types'
import { drivers, type SettlementDraft, type Trip, type TripDraft, type TripRecord } from './types'

// Bản mô phỏng trong bộ nhớ; API thật cần transaction để một đơn không nằm ở hai chuyến.

const findTrip = (id: string) => {
  const trip = db.trips.find((item) => item.id === id)
  if (!trip) throw mockError(404, 'Không tìm thấy chuyến giao.')
  return trip
}
const ordersOf = (trip: TripRecord) => trip.orderIds.map((id) => db.orders.find((order) => order.id === id)).filter((order): order is Order => Boolean(order))

/** Đơn đã xuất kho trong chuyến này. Dữ liệu mẫu cũ chưa ghi lần xuất thì coi chuyến đã xuất phát là đã xuất. */
export const dispatchedIn = (trip: TripRecord, order: Order) =>
  order.dispatches?.length ? order.dispatches.some((dispatch) => dispatch.tripId === trip.id) : Boolean(trip.departedAt)
/** Đơn còn việc trong chuyến: chờ xuất kho, hoặc đang giao theo lần xuất của chuyến này. */
export const openIn = (trip: TripRecord, order: Order) =>
  dispatchedIn(trip, order) ? order.status === 'Đang giao' && (order.dispatches?.at(-1)?.tripId ?? trip.id) === trip.id : order.status === 'Đang chuẩn bị'

export const tripStatus = (trip: TripRecord): Trip['status'] => {
  if (trip.settlement) return 'Đã đối soát'
  if (!trip.departedAt) return 'Chờ xuất phát'
  return ordersOf(trip).some((order) => openIn(trip, order)) ? 'Đang giao' : 'Chờ đối soát'
}
const toView = (trip: TripRecord): Trip => ({ ...trip, status: tripStatus(trip) })

/** Chuyến chưa đối soát mà đơn này còn việc. Đơn đã có kết quả (kể cả giao thất bại) được xếp vào chuyến khác khi giao lại. */
export const activeTripOf = (orderId: string) => {
  const order = db.orders.find((item) => item.id === orderId)
  return db.trips.find((trip) => !trip.settlement && trip.orderIds.includes(orderId) && (!order || openIn(trip, order)))
}
const STAFF = ['ADMIN', 'SALES_STAFF'] as const
const checkAssignable = (ids: string[]) => {
  for (const id of ids) {
    const order = db.orders.find((item) => item.id === id)
    if (!order || order.method !== 'Giao tận nơi') throw mockError(400, `Đơn ${id} nhận tại quầy, không xếp vào chuyến giao.`)
    if (!canDispatch(order)) throw mockError(400, `Đơn ${id} không ở trạng thái chờ giao.`)
    const busy = activeTripOf(id)
    if (busy) throw mockError(400, `Đơn ${id} đã nằm trong chuyến ${busy.id}.`)
  }
}

/** Tiền mặt và vỏ tài xế phải bàn giao, suy ra từ phiếu thu và kết quả giao trong chuyến. */
export function expectedHandover(trip: TripRecord) {
  const since = trip.departedAt ?? trip.createdAt
  const orders = ordersOf(trip)
  return {
    cash: orders
      .flatMap((order) => order.payments)
      .filter((payment) => payment.method === 'Tiền mặt' && !payment.refund && payment.recordedAt >= since)
      .reduce((sum, payment) => sum + payment.amount, 0),
    bottles: orders.filter((order) => ['Đã giao', 'Đã hoàn tất'].includes(order.status)).reduce((sum, order) => sum + (order.bottles?.returned ?? 0), 0),
  }
}

export const tripService = {
  list: () => mockRequest(() => [...db.trips].reverse().map((trip) => ({ ...toView(trip), expected: expectedHandover(trip) }))),

  create: (draft: TripDraft) =>
    mockRequest(() => {
      requireRole([...STAFF], 'tạo chuyến giao')
      if (!draft.driver?.trim() || !drivers.includes(draft.driver)) throw mockError(400, 'Chọn tài xế giao hàng.')
      const orderIds = [...new Set(draft.orderIds ?? [])]
      if (!orderIds.length) throw mockError(400, 'Chọn ít nhất một đơn cho chuyến.')
      checkAssignable(orderIds)
      const next = Math.max(0, ...db.trips.map((trip) => Number(trip.id.replace('CG-', '')) || 0)) + 1
      const trip: TripRecord = {
        id: `CG-${String(next).padStart(3, '0')}`,
        driver: draft.driver,
        vehicle: draft.vehicle?.trim() || undefined,
        orderIds,
        createdAt: new Date().toISOString(),
      }
      db.trips.push(trip)
      logActivity('Giao hàng', trip.id, `Tạo chuyến cho ${trip.driver}: ${orderIds.join(', ')}`)
      return toView(trip)
    }),

  /** Xuất kho (Dispatch) một đơn hoặc mọi đơn chưa xuất của chuyến. Chỉ nhân viên cửa hàng; tài xế không xuất kho. */
  dispatch: (id: string, orderId?: string) =>
    mockRequest(() => {
      const trip = findTrip(id)
      requireRole([...STAFF], 'xuất kho')
      if (trip.settlement) throw mockError(400, 'Chuyến đã đối soát.')
      if (orderId && !trip.orderIds.includes(orderId)) throw mockError(400, `Đơn ${orderId} không thuộc chuyến này.`)
      const orders = ordersOf(trip).filter((order) => (orderId ? order.id === orderId : !dispatchedIn(trip, order)))
      if (!orders.length) throw mockError(400, 'Không còn đơn chờ xuất kho.')
      // Kiểm tra mọi đơn trước khi xuất để không xuất dở dang.
      const blocked = orders.filter((order) => !canDispatch(order) || dispatchedIn(trip, order))
      if (blocked.length) throw mockError(400, `Bỏ các đơn không còn chờ giao trước khi xuất kho: ${blocked.map((order) => order.id).join(', ')}.`)
      orders.forEach((order) => beginDelivery(order, `chuyến ${trip.id}, tài xế ${trip.driver}`, trip.id))
      trip.departedAt ??= new Date().toISOString()
      logActivity('Giao hàng', trip.id, `Xuất kho ${orders.map((order) => order.id).join(', ')} (${mockActor()})`)
      return toView(trip)
    }),

  addOrders: (id: string, orderIds: string[]) =>
    mockRequest(() => {
      const trip = findTrip(id)
      requireRole([...STAFF], 'sửa chuyến giao')
      // Như BE: chỉ thêm đơn vào chuyến chưa xuất kho (CREATED).
      if (trip.departedAt) throw mockError(400, 'Chuyến đã xuất kho, không thêm đơn được. Tạo chuyến mới.')
      const ids = [...new Set(orderIds ?? [])].filter((item) => !trip.orderIds.includes(item))
      if (!ids.length) throw mockError(400, 'Chọn ít nhất một đơn để thêm.')
      checkAssignable(ids)
      trip.orderIds.push(...ids)
      logActivity('Giao hàng', trip.id, `Thêm đơn ${ids.join(', ')} vào chuyến`)
      return toView(trip)
    }),

  removeOrder: (id: string, orderId: string) =>
    mockRequest(() => {
      const trip = findTrip(id)
      requireRole([...STAFF], 'sửa chuyến giao')
      const order = db.orders.find((item) => item.id === orderId)
      if (order && dispatchedIn(trip, order)) throw mockError(400, 'Đơn đã xuất kho, không bỏ khỏi chuyến được.')
      trip.orderIds = trip.orderIds.filter((item) => item !== orderId)
      logActivity('Giao hàng', trip.id, `Bỏ đơn ${orderId} khỏi chuyến`)
      if (!trip.orderIds.length) db.trips = db.trips.filter((item) => item.id !== id)
      return trip.orderIds.length ? toView(trip) : null
    }),

  cancel: (id: string) =>
    mockRequest(() => {
      const trip = findTrip(id)
      requireRole([...STAFF], 'hủy chuyến giao')
      if (trip.departedAt) throw mockError(400, 'Chuyến đã xuất kho, không hủy được. Ghi kết quả từng đơn rồi đối soát.')
      db.trips = db.trips.filter((item) => item.id !== id)
      logActivity('Giao hàng', trip.id, 'Hủy chuyến chưa xuất phát')
      return null
    }),

  settle: (id: string, draft: SettlementDraft) =>
    mockRequest(() => {
      const trip = findTrip(id)
      requireRole([...STAFF], 'đối soát chuyến')
      if (tripStatus(trip) !== 'Chờ đối soát') throw mockError(400, 'Chỉ đối soát khi mọi đơn trong chuyến đã có kết quả giao.')
      const { cashHandedOver, bottlesHandedOver } = draft
      if (!Number.isSafeInteger(cashHandedOver) || cashHandedOver < 0) throw mockError(400, 'Tiền mặt bàn giao phải là số nguyên không âm.')
      if (!Number.isSafeInteger(bottlesHandedOver) || bottlesHandedOver < 0) throw mockError(400, 'Số vỏ bàn giao phải là số nguyên không âm.')
      const expected = expectedHandover(trip)
      const mismatch = cashHandedOver !== expected.cash || bottlesHandedOver !== expected.bottles
      if (mismatch && !draft.note?.trim()) throw mockError(400, 'Có chênh lệch so với sổ, ghi rõ lý do để xử lý.')
      trip.settlement = {
        cashExpected: expected.cash,
        cashHandedOver,
        bottlesExpected: expected.bottles,
        bottlesHandedOver,
        note: draft.note?.trim() || undefined,
        settledAt: new Date().toISOString(),
        settledBy: mockActor(),
      }
      logActivity(
        'Giao hàng',
        trip.id,
        `Đối soát: tiền ${cashHandedOver.toLocaleString('vi-VN')}/${expected.cash.toLocaleString('vi-VN')} ₫, vỏ ${bottlesHandedOver}/${expected.bottles}${mismatch ? ` · Lệch: ${draft.note?.trim()}` : ''}`,
        trip.settlement.settledAt,
      )
      return toView(trip)
    }),
}
