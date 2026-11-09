import { amountDue, deliveryAttempts, jugCount, type Order } from '@/features/orders/types'
import type { DeliveryAttempt, DeliveryStop, DeliveryTrip, TripCollections } from './deliveryApi'
import { dispatchedIn, openIn } from './tripService'
import { drivers, type Trip } from './types'

// Chuyển dữ liệu mẫu sang đúng kiểu của API để bản dùng thử và tài khoản thật dùng chung một màn hình tài xế.

const numericId = (id: string, fallback: number) => Number(id.replace(/\D/g, '')) || fallback

export const demoDrivers = drivers.map((name, index) => ({ id: index + 1, name }))

export const demoAttempts = (order: Order): DeliveryAttempt[] =>
  deliveryAttempts(order).map((attempt, index) => ({
    id: index + 1,
    attemptNo: index + 1,
    outcome: attempt.success ? 'SUCCESS' : 'FAILED',
    recipientName: null,
    failureReason: attempt.reason ?? null,
    note: null,
    attemptedAt: attempt.at,
  }))

function toStop(trip: Trip, order: Order, index: number): DeliveryStop {
  const id = numericId(order.id, index + 1)
  const stairs = order.floor ? `Lầu ${order.floor} (thang bộ)` : undefined
  const fallback: DeliveryAttempt = {
    id: 1,
    attemptNo: 1,
    outcome: order.status === 'Giao thất bại' ? 'FAILED' : 'SUCCESS',
    recipientName: null,
    failureReason: null,
    note: null,
    attemptedAt: order.deliveredAt ?? trip.createdAt,
  }
  return {
    id,
    orderId: id,
    orderCode: order.code ?? order.id,
    orderStatus: dispatchedIn(trip, order) ? 'OUT_FOR_DELIVERY' : 'PREPARING',
    recipientName: order.customer,
    recipientPhone: order.phone?.replace(/\s/g, '') || null,
    deliveryAddress: [order.address, order.area].filter(Boolean).join(', ') || null,
    requestedDeliveryAt: order.appointment ?? null,
    note: [order.note, stairs].filter(Boolean).join(' · ') || null,
    latestAttempt: openIn(trip, order) ? null : (demoAttempts(order).at(-1) ?? fallback),
    items: order.lines.map((line) => ({
      productId: numericId(line.productId, 0),
      productName: line.name,
      unit: line.unit,
      lotCode: '',
      quantity: line.quantity,
    })),
  }
}

export function toDriverTrip(trip: Trip, stops: Order[], index = 0): DeliveryTrip {
  return {
    id: numericId(trip.id, index + 1),
    driverId: demoDrivers.find((driver) => driver.name === trip.driver)?.id ?? null,
    driverName: trip.driver,
    vehicle: trip.vehicle ?? null,
    status: trip.settlement ? 'COMPLETED' : trip.departedAt ? 'IN_PROGRESS' : 'CREATED',
    createdAt: trip.createdAt,
    startedAt: trip.departedAt ?? null,
    endedAt: trip.settlement?.settledAt ?? null,
    createdBy: 0,
    orders: stops.map((order, stopIndex) => toStop(trip, order, stopIndex)),
    settlement: null,
  }
}

export function demoCollections(trip: Trip, stops: Order[]): TripCollections {
  return {
    receipts: [],
    balances: stops.map((order, index) => {
      const due = amountDue(order)
      return {
        orderId: numericId(order.id, index + 1),
        total: order.total,
        paid: order.total - due,
        due,
        bottlesToExchange: jugCount(order),
      }
    }),
    cashExpected: trip.expected?.cash ?? 0,
    bottlesExpected: trip.expected?.bottles ?? 0,
  }
}
