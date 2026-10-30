// Mô hình giao diện cho bản demo; chưa phải API contract của backend.
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

export type TripDraft = { driver: string; vehicle?: string; orderIds: string[] }
export type SettlementDraft = { cashHandedOver: number; bottlesHandedOver: number; note?: string }

/** Nhân viên giao hàng mẫu; chưa có module nhân viên. */
export const drivers = ['Trần Văn Tài', 'Lê Minh Quân', 'Phạm Đức Huy']
