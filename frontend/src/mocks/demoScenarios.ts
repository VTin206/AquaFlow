import type { Order, Payment } from '@/features/orders/types'
import { waterProducts } from './waterCatalog'

// Tình huống hư cấu để thử bảng, bộ lọc và các bước xử lý trong bản demo frontend.
/** Khách mẫu ban đầu; số vỏ đang giữ được chuyển thành dòng "Số dư đầu kỳ" trong sổ vỏ. */
export type SeedCustomer = { name: string; phone: string; area: string; orders: number; bottlesHeld: number }

export const additionalCustomers: SeedCustomer[] = [
  { name: 'Phạm Ngọc Mai', phone: '0900000101', area: 'Bình Thạnh', orders: 16, bottlesHeld: 2 },
  { name: 'Công ty Minh Khôi', phone: '0900000102', area: 'Thủ Đức', orders: 42, bottlesHeld: 12 },
  { name: 'Đặng Quốc Bảo', phone: '0900000103', area: 'Gò Vấp', orders: 7, bottlesHeld: 0 },
  { name: 'Quán cà phê Mộc', phone: '0900000104', area: 'Phú Nhuận', orders: 35, bottlesHeld: 6 },
  { name: 'Võ Thu Hà', phone: '0900000105', area: 'Tân Bình', orders: 4, bottlesHeld: 1 },
  { name: 'Trung tâm Anh ngữ Bình Minh', phone: '0900000106', area: 'Thủ Đức', orders: 26, bottlesHeld: 8 },
  { name: 'Hoàng Minh Đức', phone: '0900000107', area: 'Bình Tân', orders: 9, bottlesHeld: 0 },
  { name: 'Nhà hàng An Nhiên', phone: '0900000108', area: 'Bình Thạnh', orders: 58, bottlesHeld: 10 },
  { name: 'Bùi Thanh Trúc', phone: '0900000109', area: 'Gò Vấp', orders: 3, bottlesHeld: 0 },
  { name: 'Văn phòng Sao Việt', phone: '0900000110', area: 'Tân Phú', orders: 21, bottlesHeld: 4 },
  { name: 'Đỗ Hải Yến', phone: '0900000111', area: 'Phú Nhuận', orders: 11, bottlesHeld: 2 },
  { name: 'Tiệm bánh Nắng', phone: '0900000112', area: 'Tân Bình', orders: 14, bottlesHeld: 3 },
  { name: 'Nguyễn Gia Hân', phone: '0900000113', area: 'Thủ Đức', orders: 0, bottlesHeld: 0 },
]

type Scenario = {
  status: Order['status']
  customer: number
  lines: [productId: string, quantity: number][]
  payment?: 'partial' | 'full' | 'split'
  counter?: boolean
  fee?: number
  note?: string
  /** Giờ hẹn giao, tính bằng phút sau lúc tạo đơn. */
  appointmentAfter?: number
}

const scenarios: Scenario[] = [
  { status: 'Đã giao', customer: 0, lines: [['P-004', 3]], payment: 'partial', fee: 15000, appointmentAfter: 10, note: 'Khách đã chuyển một phần, thu phần còn lại sau khi đối soát.' },
  { status: 'Đã hoàn tất', customer: 1, lines: [['P-009', 8], ['P-016', 4]], payment: 'split', fee: 20000, note: 'Giao hàng tại quầy lễ tân.' },
  { status: 'Đang giao', customer: 2, lines: [['P-012', 2]], payment: 'full', fee: 10000, appointmentAfter: 30 },
  { status: 'Giao thất bại', customer: 3, lines: [['P-010', 4]], fee: 15000 },
  { status: 'Đã hủy', customer: 4, lines: [['P-004', 2]], fee: 10000, note: 'Khách đổi kế hoạch, chưa thu tiền.' },
  { status: 'Đang chuẩn bị', customer: 5, lines: [['P-009', 6], ['P-012', 3]], payment: 'partial', fee: 20000 },
  { status: 'Chờ xác nhận', customer: 6, lines: [['P-016', 2]], counter: true },
  { status: 'Đã giao', customer: 7, lines: [['P-010', 10], ['P-016', 6]], fee: 20000, note: 'Liên hệ quản lý để nhận tiền hàng.' },
  { status: 'Đã hoàn tất', customer: 8, lines: [['P-012', 1]], payment: 'full', counter: true },
  { status: 'Đang giao', customer: 9, lines: [['P-004', 4], ['P-016', 2]], payment: 'partial', fee: 15000 },
  { status: 'Chờ xác nhận', customer: 10, lines: [['P-004', 2]], fee: 10000, note: 'Gọi điện trước khi giao.' },
  { status: 'Đang chuẩn bị', customer: 11, lines: [['P-010', 3]], counter: true },
  { status: 'Đã hoàn tất', customer: 0, lines: [['P-009', 2], ['P-012', 1]], payment: 'split', fee: 10000 },
  { status: 'Giao thất bại', customer: 1, lines: [['P-004', 5]], payment: 'full', fee: 20000, note: 'Đã thanh toán; liên hệ khách để sắp xếp giao lại.' },
  { status: 'Đã hủy', customer: 2, lines: [['P-016', 1]], counter: true },
  { status: 'Đã giao', customer: 3, lines: [['P-010', 5], ['P-012', 2]], payment: 'partial', fee: 10000 },
  { status: 'Đang chuẩn bị', customer: 4, lines: [['P-004', 1]], payment: 'full', fee: 10000 },
  { status: 'Đã hoàn tất', customer: 5, lines: [['P-009', 10], ['P-016', 5]], payment: 'split', fee: 20000 },
  { status: 'Chờ xác nhận', customer: 6, lines: [['P-012', 3]], fee: 15000 },
  { status: 'Đang giao', customer: 7, lines: [['P-010', 6], ['P-016', 2]], fee: 15000 },
]

export const additionalOrders: Order[] = scenarios.map((scenario, index): Order => {
  const customer = additionalCustomers[scenario.customer]
  const id = `AF-${1049 + index}`
  const at = (minutes: number) => new Date(Date.parse('2026-10-16T10:00:00+07:00') + (index * 10 + minutes) * 60_000).toISOString()
  const lines = scenario.lines.map(([productId, quantity]) => {
    const product = waterProducts.find((item) => item.id === productId)
    if (!product) throw new Error(`Sản phẩm mẫu không tồn tại: ${productId}`)
    return { productId, name: product.name, unit: product.unit, unitPrice: product.price, quantity }
  })
  const deliveryFee = scenario.counter ? 0 : scenario.fee ?? 0
  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) + deliveryFee
  const firstPayment = scenario.payment === 'full' ? total : Math.floor(total / 2 / 1000) * 1000
  const payments: Payment[] = scenario.payment ? [{
    id: `PT-${id}-1`, amount: firstPayment, method: 'Chuyển khoản', reference: `DEMO-${id}-01`, recordedAt: at(3),
  }] : []
  if (scenario.payment === 'split') payments.push({ id: `PT-${id}-2`, amount: total - firstPayment, method: 'Tiền mặt', recordedAt: at(16) })

  const history: Order['history'] = [{ at: at(0), message: 'Tiếp nhận đơn hàng.' }]
  if (!['Chờ xác nhận', 'Đã hủy'].includes(scenario.status)) history.push({ at: at(2), message: 'Xác nhận đơn, chốt giá và giữ hàng.' })
  for (const payment of payments) history.push({ at: payment.recordedAt, message: `Ghi nhận ${payment.amount.toLocaleString('vi-VN')} ₫ · ${payment.method}` })
  if (['Đang giao', 'Đã giao', 'Đã hoàn tất', 'Giao thất bại'].includes(scenario.status) && !scenario.counter) history.push({ at: at(5), message: 'Bắt đầu giao hàng.' })
  if (scenario.status === 'Giao thất bại') history.push({ at: at(15), message: 'Giao thất bại: không liên hệ được người nhận. Cần hẹn lại thời gian giao.' })
  if (['Đã giao', 'Đã hoàn tất'].includes(scenario.status)) history.push({ at: at(15), message: `${scenario.counter ? 'Khách nhận tại quầy' : 'Giao thành công'} · Người nhận: ${customer.name}` })
  if (scenario.status === 'Đã hoàn tất') history.push({ at: at(17), message: 'Đã bàn giao và thu đủ tiền. Hoàn tất đơn.' })
  if (scenario.status === 'Đã hủy') history.push({ at: at(4), message: 'Hủy đơn: khách thay đổi nhu cầu, chưa xác nhận và chưa thu tiền.' })
  history.sort((a, b) => a.at.localeCompare(b.at))

  return {
    id, customer: customer.name, phone: customer.phone,
    address: scenario.counter ? 'Nhận tại cửa hàng' : `${20 + index * 3} Đường số ${index % 5 + 1}, ${customer.area}, TP. Hồ Chí Minh`,
    time: `${10 + Math.floor(index / 6)}:${String(index % 6 * 10).padStart(2, '0')}`,
    method: scenario.counter ? 'Tại quầy' : 'Giao tận nơi',
    channel: scenario.counter ? 'Tại quầy' : (['Điện thoại', 'Tin nhắn', 'Website'] as const)[index % 3],
    status: scenario.status, lines, deliveryFee, total, payments, history, note: scenario.note,
    appointment: scenario.appointmentAfter && !scenario.counter ? at(scenario.appointmentAfter) : undefined,
    items: lines.map((line) => `${line.quantity} ${line.unit.toLowerCase()} ${line.name}`).join(', '),
    stockReserved: ['Đang chuẩn bị', 'Đang giao', 'Giao thất bại'].includes(scenario.status),
  }
}).reverse()
