import type { TripRecord } from '../features/delivery/types'
import type { Order, OrderLine } from '../features/orders/types'
import type { CustomerRecord } from '../features/customers/types'
import type { Product } from '../features/inventory/types'
import { suggestedDeliveryFee } from '../shared/policy'
import type { ActivityArea, ActivityEntry } from './session'

// Đơn đã đóng của các ngày trước, sinh ngẫu nhiên có hạt giống cố định để báo cáo theo kỳ có số liệu.
// Backend thật truy vấn theo kỳ; các đơn này không hiện ở màn hình xử lý đơn hằng ngày.

const ADMIN = 'Nguyễn An'
const SALES = 'Lê Thu Trang'
const DRIVERS = ['Trần Văn Tài', 'Lê Minh Quân', 'Phạm Đức Huy']
const HISTORY_DAYS = 60

/** Bộ sinh số giả ngẫu nhiên (mulberry32) để dữ liệu giống nhau mỗi lần tải. */
function random(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const addMinutes = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60_000).toISOString()

export function archivedOrders(products: Product[], customers: CustomerRecord[]): Order[] {
  const next = random(20261016)
  const pick = <T,>(items: T[]) => items[Math.floor(next() * items.length)]
  const sellable = products.filter((product) => product.sku !== 'VO-20L' && product.price > 0)
  // Hàng bán chạy xuất hiện nhiều hơn.
  const popular = sellable.filter((product) => ['P-004', 'P-009', 'P-010', 'P-012', 'P-016'].includes(product.id))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const orders: Order[] = []
  let sequence = 1

  for (let back = HISTORY_DAYS; back >= 1; back--) {
    const day = new Date(today.getTime() - back * 86_400_000)
    const weekend = day.getDay() === 0 || day.getDay() === 6
    const count = Math.round((weekend ? 5 : 8) + next() * 7)
    for (let n = 0; n < count; n++) {
      const customer = pick(customers)
      const delivery = next() < 0.72
      const lineCount = next() < 0.7 ? 1 : 2
      const lines: OrderLine[] = []
      for (let i = 0; i < lineCount; i++) {
        const product = next() < 0.8 ? pick(popular) : pick(sellable)
        if (lines.some((line) => line.productId === product.id)) continue
        const quantity = product.unit === 'Bình' ? 1 + Math.floor(next() * 5) : 1 + Math.floor(next() * 4)
        lines.push({ productId: product.id, name: product.name, unit: product.unit, quantity, unitPrice: product.price })
      }
      const units = lines.reduce((sum, line) => sum + line.quantity, 0)
      const jugs = lines.filter((line) => line.unit === 'Bình').reduce((sum, line) => sum + line.quantity, 0)
      const floor = delivery && next() < 0.25 ? 1 + Math.floor(next() * 4) : 0
      const deliveryFee = delivery ? suggestedDeliveryFee({ units, jugs, floor }) : 0
      const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
      const total = subtotal + deliveryFee

      const createdAt = new Date(day.getTime() + (7 * 60 + Math.floor(next() * 11 * 60)) * 60_000).toISOString()
      const channel: Order['channel'] = delivery ? pick(['Điện thoại', 'Điện thoại', 'Tin nhắn', 'Website'] as const) : 'Tại quầy'
      const id = `AF-${String(sequence++).padStart(4, '0')}`
      const history: Order['history'] = [{ at: createdAt, message: channel === 'Website' ? 'Khách đặt qua website.' : 'Tiếp nhận yêu cầu.', by: channel === 'Website' ? `${customer.name} (khách, website)` : SALES }]
      const order: Order = {
        id,
        customerId: customer.id,
        customer: customer.name,
        phone: customer.phone,
        address: delivery ? customer.addresses[0] ?? customer.area : 'Nhận tại cửa hàng',
        items: lines.map((line) => `${line.quantity} ${line.unit.toLowerCase()} ${line.name}`).join(', '),
        total,
        time: new Date(createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        status: 'Đã hoàn tất',
        method: delivery ? 'Giao tận nơi' : 'Tại quầy',
        channel,
        lines,
        deliveryFee,
        floor: floor || undefined,
        payments: [],
        history,
        stockReserved: false,
      }

      if (next() < 0.05) {
        order.status = 'Đã hủy'
        history.push({ at: addMinutes(createdAt, 20), message: 'Hủy đơn: khách đổi kế hoạch.', by: SALES })
        orders.push(order)
        continue
      }
      history.push({ at: addMinutes(createdAt, 5), message: 'Xác nhận đơn, chốt giá và giữ hàng.', by: SALES })
      let handoverAt = addMinutes(createdAt, 15 + Math.floor(next() * 30))
      if (delivery) {
        const driver = pick(DRIVERS)
        if (next() < 0.4) order.appointment = addMinutes(createdAt, 90 + Math.floor(next() * 120))
        history.push({ at: addMinutes(createdAt, 25), message: 'Bắt đầu giao hàng.', by: driver })
        if (next() < 0.07) {
          history.push({ at: addMinutes(createdAt, 70), message: 'Giao thất bại: không liên hệ được người nhận.', by: driver })
          history.push({ at: addMinutes(createdAt, 150), message: 'Bắt đầu lần giao lại.', by: driver })
          handoverAt = addMinutes(createdAt, 190 + Math.floor(next() * 60))
        } else {
          handoverAt = addMinutes(createdAt, 45 + Math.floor(next() * 120))
        }
        const late = order.appointment ? Math.max(0, Math.floor((Date.parse(handoverAt) - Date.parse(order.appointment)) / 60_000)) : 0
        history.push({ at: handoverAt, message: `Giao thành công · Người nhận: ${customer.name}${late ? ` · Trễ ${late} phút so với giờ hẹn` : ''}`, by: driver })
      } else {
        history.push({ at: handoverAt, message: `Khách nhận tại quầy · Người nhận: ${customer.name}`, by: SALES })
      }
      order.deliveredAt = handoverAt
      const method = next() < 0.6 ? 'Tiền mặt' : 'Chuyển khoản'
      order.payments.push({
        id: `PT-${order.id}-1`,
        amount: total,
        method,
        reference: method === 'Chuyển khoản' ? `FT${order.id.replace(/\D/g, '')}` : undefined,
        recordedAt: handoverAt,
        by: SALES,
      })
      history.push({ at: handoverAt, message: `Ghi nhận ${total.toLocaleString('vi-VN')} ₫ · ${method}`, by: SALES })

      // Thỉnh thoảng khách trả lại hàng lỗi.
      if (next() < 0.02) {
        const line = lines[0]
        const returnedAt = addMinutes(handoverAt, 24 * 60)
        const value = line.unitPrice
        order.total -= value
        order.returns = [{ id: `TH-${order.id}-1`, at: returnedAt, by: ADMIN, lines: [{ ...line, quantity: 1 }], reason: 'Bình móp, rò nước.', restocked: false, refunded: value }]
        order.payments.push({ id: `HT-${order.id}-1`, amount: value, method: 'Tiền mặt', recordedAt: returnedAt, refund: true, by: ADMIN })
        history.push({ at: returnedAt, message: `Nhận trả 1 ${line.unit.toLowerCase()} ${line.name}: Bình móp, rò nước.`, by: ADMIN })
      }
      orders.push(order)
    }
  }
  return orders.reverse()
}

/**
 * Mỗi tài xế một chuyến mỗi ngày cho các đơn giao tận nơi đã đóng, đối soát lúc cuối ngày.
 * Thỉnh thoảng tài xế nộp thiếu để báo cáo đối soát có số liệu minh họa.
 */
export function archivedTrips(orders: Order[]): TripRecord[] {
  const next = random(20261020)
  const groups = new Map<string, Order[]>()
  for (const order of orders.filter((item) => item.method === 'Giao tận nơi' && item.deliveredAt)) {
    const driver = order.history.find((event) => event.message.startsWith('Bắt đầu giao'))?.by
    if (!driver) continue
    const key = `${new Date(order.deliveredAt!).toLocaleDateString('sv-SE')}|${driver}`
    groups.set(key, [...(groups.get(key) ?? []), order])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list], index) => {
      const [, driver] = key.split('|')
      const departures = list.map((order) => order.history.find((event) => event.message.startsWith('Bắt đầu giao'))!.at).sort()
      const last = list.map((order) => order.deliveredAt!).sort().at(-1)!
      const cash = list.flatMap((order) => order.payments).filter((payment) => payment.method === 'Tiền mặt' && !payment.refund).reduce((sum, payment) => sum + payment.amount, 0)
      const short = cash > 0 && next() < 0.08 ? Math.min(cash, (1 + Math.floor(next() * 5)) * 10_000) : 0
      return {
        id: `CG-L${String(index + 1).padStart(4, '0')}`,
        driver,
        orderIds: list.map((order) => order.id),
        createdAt: departures[0],
        departedAt: departures[0],
        settlement: {
          cashExpected: cash,
          cashHandedOver: cash - short,
          bottlesExpected: 0,
          bottlesHandedOver: 0,
          note: short ? 'Tài xế báo thối nhầm tiền cho khách.' : undefined,
          settledAt: addMinutes(last, 60),
          settledBy: ADMIN,
        },
      }
    })
}

const areaOf = (message: string): ActivityArea => (/^(Ghi nhận|Hoàn)/.test(message) ? 'Thanh toán' : 'Đơn hàng')

/** Nhật ký ban đầu dựng từ lịch sử các đơn mẫu (gần nhất trước). */
export function seedActivity(orders: Order[]): ActivityEntry[] {
  const entries = orders.flatMap((order) => order.history.map((event) => ({ at: event.at, by: event.by ?? ADMIN, area: areaOf(event.message), target: order.id, action: event.message })))
  return entries.sort((a, b) => a.at.localeCompare(b.at)).map((entry, index) => ({ ...entry, id: `NK-${String(index + 1).padStart(5, '0')}` }))
}

/** Gán người thao tác cho lịch sử đơn mẫu đang xử lý và lấy thời điểm khách nhận hàng từ lịch sử. */
export function withActors(orders: Order[]): Order[] {
  return orders.map((order) => {
    const history = order.history.map((event) => ({
      ...event,
      by:
        event.by ??
        (/^(Bắt đầu|Giao)/.test(event.message)
          ? DRIVERS[0]
          : /^Tiếp nhận/.test(event.message) && order.channel === 'Website'
            ? `${order.customer} (khách, website)`
            : SALES),
    }))
    const handover = [...history].reverse().find((event) => /^(Giao thành công|Khách nhận)/.test(event.message))
    return { ...order, history, deliveredAt: order.deliveredAt ?? (['Đã giao', 'Đã hoàn tất'].includes(order.status) ? handover?.at : undefined) }
  })
}
