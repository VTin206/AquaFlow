// Kiểu chuyến dùng cho phiếu in và trạng thái hiển thị.
export type TripStatus = 'Chờ xuất phát' | 'Đang giao' | 'Chờ đối soát' | 'Đã đối soát'
// Chờ xuất phát: chưa xuất kho đơn nào (BE: CREATED). Đang giao: còn đơn chờ xuất hoặc đang giao (IN_PROGRESS).

export type TripSettlement = {
  /** Tiền mặt tài xế thu trong chuyến theo phiếu thu đã ghi. */
  cashExpected: number
  cashHandedOver: number
  /** Vỏ rỗng thu về theo kết quả giao. */
  bottlesExpected: number
  bottlesHandedOver: number
  note?: string
  settledAt: string
  settledBy?: string
}

export type TripRecord = {
  id: string
  driver: string
  vehicle?: string
  orderIds: string[]
  createdAt: string
  departedAt?: string
  settlement?: TripSettlement
}

export type Trip = TripRecord & { status: TripStatus; expected?: { cash: number; bottles: number } }
