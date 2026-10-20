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

export const tripStatus = (trip: TripRecord): Trip['status'] => {
  if (trip.settlement) return 'Đã đối soát'
  if (!trip.departedAt) return 'Chờ xuất phát'
  return ordersOf(trip).some((order) => order.status === 'Đang giao') ? 'Đang giao' : 'Chờ đối soát'
}
const toView = (trip: TripRecord): Trip => ({ ...trip, status: tripStatus(trip) })

/** Chuyến chưa đối soát đang chứa đơn này. */
export const activeTripOf = (orderId: string) => db.trips.find((trip) => !trip.settlement && trip.orderIds.includes(orderId))

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
      requireRole(['ADMIN', 'SALES_STAFF'], 'tạo chuyến giao')
      if (!draft.driver?.trim() || !drivers.includes(draft.driver)) throw mockError(400, 'Chọn tài xế giao hàng.')
      const orderIds = [...new Set(draft.orderIds ?? [])]
      if (!orderIds.length) throw mockError(400, 'Chọn ít nhất một đơn cho chuyến.')
      for (const id of orderIds) {
        const order = db.orders.find((item) => item.id === id)
        if (!order || !canDispatch(order)) throw mockError(400, `Đơn ${id} không ở trạng thái chờ giao.`)
        const busy = activeTripOf(id)
        if (busy) throw mockError(400, `Đơn ${id} đã nằm trong chuyến ${busy.id}.`)
      }
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

  depart: (id: string) =>
    mockRequest(() => {
      const trip = findTrip(id)
      requireRole(['ADMIN', 'SALES_STAFF', 'DELIVERY_STAFF'], 'cho chuyến xuất phát')
      if (tripStatus(trip) !== 'Chờ xuất phát') throw mockError(400, 'Chuyến đã xuất phát.')
      // Kiểm tra mọi đơn trước khi chuyển trạng thái để không xuất phát dở dang.
      const orders = ordersOf(trip)
      const blocked = orders.filter((order) => !canDispatch(order) && order.status !== 'Đang giao')
      if (blocked.length) throw mockError(400, `Bỏ các đơn không còn chờ giao trước khi xuất phát: ${blocked.map((order) => order.id).join(', ')}.`)
      orders.filter(canDispatch).forEach((order) => beginDelivery(order, `chuyến ${trip.id}, tài xế ${trip.driver}`))
      trip.departedAt = new Date().toISOString()
      logActivity('Giao hàng', trip.id, `Xuất phát (${mockActor()})`, trip.departedAt)
      return toView(trip)
    }),

  removeOrder: (id: string, orderId: string) =>
    mockRequest(() => {
      const trip = findTrip(id)
      requireRole(['ADMIN', 'SALES_STAFF'], 'sửa chuyến giao')
      if (trip.departedAt) throw mockError(400, 'Chỉ bỏ đơn khi chuyến chưa xuất phát.')
      trip.orderIds = trip.orderIds.filter((item) => item !== orderId)
      logActivity('Giao hàng', trip.id, `Bỏ đơn ${orderId} khỏi chuyến`)
      if (!trip.orderIds.length) db.trips = db.trips.filter((item) => item.id !== id)
      return trip.orderIds.length ? toView(trip) : null
    }),

  cancel: (id: string) =>
    mockRequest(() => {
      const trip = findTrip(id)
      requireRole(['ADMIN', 'SALES_STAFF'], 'hủy chuyến giao')
      if (trip.departedAt) throw mockError(400, 'Chuyến đã xuất phát, không hủy được. Ghi kết quả từng đơn rồi đối soát.')
      db.trips = db.trips.filter((item) => item.id !== id)
      logActivity('Giao hàng', trip.id, 'Hủy chuyến chưa xuất phát')
      return null
    }),

  settle: (id: string, draft: SettlementDraft) =>
    mockRequest(() => {
      const trip = findTrip(id)
      requireRole(['ADMIN', 'SALES_STAFF'], 'đối soát chuyến')
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
