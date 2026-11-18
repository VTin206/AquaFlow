import { DEPOSIT_PER_BOTTLE } from '@/shared/policy'

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
  /** Thời điểm đặt đơn gần nhất (không tính đơn đã hủy); thiếu là chưa mua lần nào. */
  lastOrderAt?: string
  /** Địa chỉ hiện trong danh sách: địa chỉ mặc định, bản thật tạm lấy địa chỉ giao của đơn gần nhất. */
  mainAddress?: string
}

export type CustomerDraft = Pick<CustomerRecord, 'name' | 'phone' | 'type' | 'area' | 'addresses' | 'note'>

export { DEPOSIT_PER_BOTTLE }

/** Mã hiển thị: bản dùng thử đã có dạng KH-001, tài khoản thật là số. */
export const customerCode = (customer: Pick<Customer, 'id'>) =>
  customer.id.startsWith('KH-') ? customer.id : `KH-${customer.id.padStart(3, '0')}`

export const initialsOf = (name: string) => {
  const words = name.trim().split(/\s+/)
  return (words.length > 1 ? words.at(-2)![0] + words.at(-1)![0] : words[0].slice(0, 2)).toUpperCase()
}

/** Phần cọc vượt quá số vỏ khách còn giữ, có thể hoàn lại. */
export const refundableOf = (customer: Pick<Customer, 'bottlesHeld' | 'depositHeld'>) =>
  Math.max(0, customer.depositHeld - customer.bottlesHeld * DEPOSIT_PER_BOTTLE)
