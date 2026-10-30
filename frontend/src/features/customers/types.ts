import { DEPOSIT_PER_BOTTLE } from '../../shared/policy'

export type CustomerType = 'Cá nhân' | 'Doanh nghiệp'

/** Hồ sơ lưu trữ. Số vỏ, tiền cọc và công nợ không lưu ở đây mà tính từ sổ vỏ và đơn hàng. */
export type CustomerRecord = {
  id: string
  name: string
  phone: string
  type: CustomerType
  /** Khu vực ngắn gọn để lọc và xếp chuyến (quận/phường). */
  area: string
  /** Địa chỉ giao đã dùng; đơn cũ vẫn giữ địa chỉ đã chốt tại thời điểm đặt. */
  addresses: string[]
  note?: string
  /** Số đơn trước khi có hệ thống (dữ liệu chuyển đổi). */
  legacyOrders: number
  /** false khi hồ sơ đã lưu trữ; thiếu nghĩa là đang hoạt động. */
  active?: boolean
}

export type Customer = CustomerRecord & {
  initials: string
  orders: number
  /** Số vỏ bình khách đang giữ, tính từ sổ vỏ. */
  bottlesHeld: number
  /** Tiền cọc vỏ cửa hàng đang giữ của khách, tính từ sổ vỏ. Không phải doanh thu. */
  depositHeld: number
  /** Tổng tiền hàng còn phải thu trên các đơn chưa hủy. */
  debt: number
}

export type CustomerDraft = Pick<CustomerRecord, 'name' | 'phone' | 'type' | 'area' | 'addresses' | 'note'>

export type BottleEntryKind = 'Số dư đầu kỳ' | 'Giao kèm đơn' | 'Thu vỏ' | 'Phí thu hồi' | 'Báo mất/vỡ' | 'Thu cọc' | 'Hoàn cọc'

/** Một dòng sổ vỏ. `bottles` và `deposit` là thay đổi có dấu của số dư khách đang giữ. */
export type BottleEntry = {
  id: string
  customerId: string
  at: string
  kind: BottleEntryKind
  bottles: number
  deposit: number
  orderId?: string
  note?: string
  /** Nhân viên ghi sổ. */
  by?: string
}

export type BottleAction = {
  kind: 'Thu vỏ' | 'Báo mất/vỡ' | 'Thu cọc' | 'Hoàn cọc'
  bottles?: number
  deposit?: number
  note?: string
  /** Thu vỏ: cửa hàng đến thu hồi tận nơi (có thể tính phí). */
  pickup?: boolean
}

export { DEPOSIT_PER_BOTTLE }

/** Mã hiển thị: bản dùng thử đã có dạng KH-001, tài khoản thật là số. */
export const customerCode = (customer: Pick<Customer, 'id'>) => (customer.id.startsWith('KH-') ? customer.id : `KH-${customer.id.padStart(3, '0')}`)

export const normalizePhone = (phone: string) => phone.replace(/\D/g, '')

export const initialsOf = (name: string) => {
  const words = name.trim().split(/\s+/)
  return (words.length > 1 ? words.at(-2)![0] + words.at(-1)![0] : words[0].slice(0, 2)).toUpperCase()
}

export const guessCustomerType = (name: string): CustomerType =>
  /^(công ty|văn phòng|cửa hàng|nhà hàng|quán|tiệm|trung tâm|trường)/i.test(name.trim()) ? 'Doanh nghiệp' : 'Cá nhân'

/** Phần cọc vượt quá số vỏ khách còn giữ, có thể hoàn lại. */
export const refundableOf = (customer: Pick<Customer, 'bottlesHeld' | 'depositHeld'>) => Math.max(0, customer.depositHeld - customer.bottlesHeld * DEPOSIT_PER_BOTTLE)
