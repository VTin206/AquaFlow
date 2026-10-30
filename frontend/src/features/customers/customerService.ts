import { db } from '../../mocks/db'
import { mockError, mockRequest } from '../../mocks/mockRequest'
import { logActivity, mockActor, requireRole } from '../../mocks/session'
import { PICKUP_FEE, PICKUP_FEE_BELOW } from '../../shared/policy'
import { amountDue } from '../orders/types'
import {
  DEPOSIT_PER_BOTTLE,
  guessCustomerType,
  initialsOf,
  normalizePhone,
  type BottleAction,
  type BottleEntry,
  type Customer,
  type CustomerDraft,
  type CustomerRecord,
} from './types'

// Đang dùng dữ liệu mẫu. Khi backend có API, thay thân hàm bằng api.get/post tương ứng.
// Số vỏ và cọc luôn tính lại từ sổ vỏ để không thể sửa trực tiếp làm mất lịch sử.

const validPhone = (phone: string) => /^(?:0\d{9,10}|84\d{9,10})$/.test(normalizePhone(phone))

export const bottleBalance = (customerId: string) =>
  db.bottleLedger
    .filter((entry) => entry.customerId === customerId)
    .reduce((balance, entry) => ({ bottles: balance.bottles + entry.bottles, deposit: balance.deposit + entry.deposit }), { bottles: 0, deposit: 0 })

/** Tiền cọc có thể hoàn: phần cọc vượt quá số vỏ khách vẫn đang giữ. */
export const refundableDeposit = (customerId: string) => {
  const balance = bottleBalance(customerId)
  return Math.max(0, balance.deposit - balance.bottles * DEPOSIT_PER_BOTTLE)
}

export function addBottleEntry(entry: Omit<BottleEntry, 'id' | 'at'>) {
  const next = Math.max(0, ...db.bottleLedger.map((item) => Number(item.id.replace('SV-', '')) || 0)) + 1
  const saved: BottleEntry = { ...entry, id: `SV-${String(next).padStart(4, '0')}`, at: new Date().toISOString(), by: mockActor() }
  db.bottleLedger.push(saved)
  if (!entry.orderId) logActivity('Khách hàng', entry.customerId, `Sổ vỏ: ${entry.kind}${entry.bottles ? ` ${entry.bottles > 0 ? '+' : ''}${entry.bottles} vỏ` : ''}${entry.deposit ? ` · cọc ${entry.deposit.toLocaleString('vi-VN')} ₫` : ''}`, saved.at)
  return saved
}

export const findCustomerByPhone = (phone: string) => db.customers.find((customer) => customer.active !== false && normalizePhone(customer.phone) === normalizePhone(phone))

/** Gắn đơn với hồ sơ khách theo số điện thoại; tạo hồ sơ mới nếu chưa có. */
export function ensureCustomer(name: string, phone: string, address?: string) {
  let customer = findCustomerByPhone(phone)
  if (!customer) {
    customer = {
      id: nextCustomerId(),
      name: name.trim(),
      phone: phone.trim(),
      type: guessCustomerType(name),
      area: address?.split(',').at(-2)?.trim() || 'Chưa phân khu vực',
      addresses: address ? [address] : [],
      legacyOrders: 0,
    }
    db.customers.unshift(customer)
  } else if (address && !customer.addresses.includes(address)) {
    customer.addresses.push(address)
  }
  return customer
}

const nextCustomerId = () => `KH-${String(Math.max(0, ...db.customers.map((customer) => Number(customer.id.replace('KH-', '')) || 0)) + 1).padStart(3, '0')}`

const toView = (record: CustomerRecord): Customer => {
  const orders = db.orders.filter((order) => order.customerId === record.id)
  const balance = bottleBalance(record.id)
  return {
    ...record,
    initials: initialsOf(record.name),
    orders: record.legacyOrders + orders.filter((order) => order.status !== 'Đã hủy').length,
    bottlesHeld: balance.bottles,
    depositHeld: balance.deposit,
    debt: orders.filter((order) => order.status !== 'Đã hủy').reduce((sum, order) => sum + amountDue(order), 0),
  }
}

function validateDraft(draft: CustomerDraft, id?: string) {
  if (!draft.name?.trim()) throw mockError(400, 'Nhập tên khách hàng.')
  if (!validPhone(draft.phone ?? '')) throw mockError(400, 'Số điện thoại không hợp lệ.')
  const duplicate = findCustomerByPhone(draft.phone)
  if (duplicate && duplicate.id !== id) throw mockError(400, `Số điện thoại đã thuộc khách ${duplicate.name} (${duplicate.id}).`)
  const addresses = (draft.addresses ?? []).map((address) => address?.trim()).filter(Boolean)
  return {
    name: draft.name.trim(),
    phone: draft.phone.trim(),
    type: draft.type,
    area: draft.area?.trim() || 'Chưa phân khu vực',
    addresses: [...new Set(addresses)],
    note: draft.note?.trim() || undefined,
  }
}

export const customerService = {
  list: () => mockRequest(() => db.customers.filter((customer) => customer.active !== false).map(toView)),

  create: (draft: CustomerDraft) =>
    mockRequest(() => {
      requireRole(['ADMIN', 'SALES_STAFF'], 'thêm khách hàng')
      const record: CustomerRecord = { id: nextCustomerId(), legacyOrders: 0, ...validateDraft(draft) }
      db.customers.unshift(record)
      logActivity('Khách hàng', record.id, `Thêm hồ sơ ${record.name}`)
      return toView(record)
    }),

  update: (id: string, draft: CustomerDraft) =>
    mockRequest(() => {
      const record = db.customers.find((customer) => customer.id === id)
      if (!record) throw mockError(404, 'Không tìm thấy khách hàng.')
      requireRole(['ADMIN', 'SALES_STAFF'], 'sửa hồ sơ khách')
      Object.assign(record, validateDraft(draft, id))
      logActivity('Khách hàng', record.id, `Cập nhật hồ sơ ${record.name}`)
      return toView(record)
    }),

  /** Lưu trữ hồ sơ: ẩn khỏi danh sách, đơn và sổ vỏ cũ giữ nguyên (giống BE). */
  deactivate: (id: string) =>
    mockRequest(() => {
      const record = db.customers.find((customer) => customer.id === id)
      if (!record) throw mockError(404, 'Không tìm thấy khách hàng.')
      requireRole(['ADMIN', 'SALES_STAFF'], 'lưu trữ hồ sơ khách')
      record.active = false
      logActivity('Khách hàng', record.id, `Lưu trữ hồ sơ ${record.name}`)
    }),

  archived: () => mockRequest(() => db.customers.filter((customer) => customer.active === false).map(toView)),

  /** Khôi phục hồ sơ đã lưu trữ: khách hiện lại trong danh sách và ô chọn khách. */
  activate: (id: string) =>
    mockRequest(() => {
      const record = db.customers.find((customer) => customer.id === id)
      if (!record) throw mockError(404, 'Không tìm thấy khách hàng.')
      requireRole(['ADMIN', 'SALES_STAFF'], 'khôi phục hồ sơ khách')
      record.active = true
      logActivity('Khách hàng', record.id, `Khôi phục hồ sơ ${record.name}`)
    }),

  ledger: (customerId: string) =>
    mockRequest(() => db.bottleLedger.filter((entry) => entry.customerId === customerId).sort((a, b) => b.at.localeCompare(a.at))),

  recordBottles: (customerId: string, action: BottleAction) =>
    mockRequest(() => {
      const record = db.customers.find((customer) => customer.id === customerId)
      if (!record) throw mockError(404, 'Không tìm thấy khách hàng.')
      // Báo mất/vỡ và hoàn cọc làm đổi tiền cọc nên cần chủ cửa hàng.
      requireRole(['Báo mất/vỡ', 'Hoàn cọc'].includes(action.kind) ? ['ADMIN'] : ['ADMIN', 'SALES_STAFF'], `ghi "${action.kind}"`)
      const balance = bottleBalance(customerId)
      const bottles = action.bottles ?? 0
      const deposit = action.deposit ?? 0
      const note = action.note?.trim() || undefined

      if (action.kind === 'Thu vỏ') {
        if (!Number.isSafeInteger(bottles) || bottles <= 0) throw mockError(400, 'Số vỏ thu về phải là số nguyên dương.')
        if (bottles > balance.bottles) throw mockError(400, `Khách chỉ đang giữ ${balance.bottles} vỏ.`)
        addBottleEntry({ customerId, kind: action.kind, bottles: -bottles, deposit: 0, note: note ?? (action.pickup ? 'Thu hồi tận nơi' : 'Khách mang vỏ đến cửa hàng') })
        // Thu hồi tận nơi dưới 10 vỏ: phí mỗi lần, cấn trừ vào tiền cọc đang giữ.
        const fee = action.pickup && bottles < PICKUP_FEE_BELOW ? Math.min(PICKUP_FEE, balance.deposit) : 0
        if (fee > 0) addBottleEntry({ customerId, kind: 'Phí thu hồi', bottles: 0, deposit: -fee, note: `Thu hồi ${bottles} vỏ tận nơi (dưới ${PICKUP_FEE_BELOW} vỏ)` })
      } else if (action.kind === 'Báo mất/vỡ') {
        if (!Number.isSafeInteger(bottles) || bottles <= 0) throw mockError(400, 'Số vỏ mất/vỡ phải là số nguyên dương.')
        if (bottles > balance.bottles) throw mockError(400, `Khách chỉ đang giữ ${balance.bottles} vỏ.`)
        if (!note) throw mockError(400, 'Ghi rõ tình huống mất/vỡ để đối soát.')
        // Cọc của vỏ mất/vỡ được cấn trừ làm tiền bồi thường, không hoàn lại.
        const forfeited = Math.min(balance.deposit, bottles * DEPOSIT_PER_BOTTLE)
        addBottleEntry({ customerId, kind: action.kind, bottles: -bottles, deposit: -forfeited, note })
      } else if (action.kind === 'Thu cọc') {
        if (!Number.isSafeInteger(deposit) || deposit <= 0) throw mockError(400, 'Tiền cọc phải lớn hơn 0.')
        addBottleEntry({ customerId, kind: action.kind, bottles: 0, deposit, note })
      } else if (action.kind === 'Hoàn cọc') {
        const refundable = refundableDeposit(customerId)
        if (!Number.isSafeInteger(deposit) || deposit <= 0) throw mockError(400, 'Tiền hoàn cọc phải lớn hơn 0.')
        if (deposit > refundable)
          throw mockError(400, `Chỉ hoàn được ${refundable.toLocaleString('vi-VN')} ₫ vì khách còn giữ ${balance.bottles} vỏ. Thu vỏ trước khi hoàn cọc.`)
        addBottleEntry({ customerId, kind: action.kind, bottles: 0, deposit: -deposit, note })
      } else {
        throw mockError(400, 'Nghiệp vụ vỏ không hợp lệ.')
      }
      return toView(record)
    }),
}
