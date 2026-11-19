import { api } from '@/shared/api/client'

export type TripCollections = {
  receipts: {
    id: number
    orderId: number
    amount: number
    method: 'CASH' | 'BANK_TRANSFER'
    bottlesReturned: number
    recordedBy: number
    createdAt: string
    /** Cọc vỏ thu cùng lần này (0 nếu không thu cọc). */
    depositAmount: number
  }[]
  balances: { orderId: number; total: number; paid: number; due: number; bottlesToExchange: number }[]
  cashExpected: number
  bottlesExpected: number
  /** Cọc thu bằng tiền mặt, tài xế phải nộp cùng tiền hàng khi đối soát. */
  depositExpected: number
}
export type CollectionInput = {
  requestId: string
  amount: number
  method: 'CASH' | 'BANK_TRANSFER'
  bottlesReturned: number
  /** Cọc cho phần vỏ khách chưa đổi; ghi vào sổ cọc của khách. */
  depositAmount?: number
}
export const collectionApi = {
  get: (tripId: number) => api.get<TripCollections>(`/delivery/trips/${tripId}/collections`),
  collect: (tripId: number, orderId: number, input: CollectionInput) =>
    api.post<TripCollections>(`/delivery/trips/${tripId}/orders/${orderId}/collections`, input),
}

export type DeliveryAttempt = {
  id: number
  attemptNo: number
  outcome: 'SUCCESS' | 'FAILED'
  recipientName: string | null
  failureReason: string | null
  note: string | null
  attemptedAt: string
}
export type DeliveryStop = {
  id: number
  orderId: number
  orderCode: string
  orderStatus: string
  recipientName: string | null
  recipientPhone: string | null
  deliveryAddress: string | null
  requestedDeliveryAt?: string | null
  /** Cuối khung giờ giao; null khi hẹn một mốc giờ requestedDeliveryAt. */
  requestedDeliveryUntil?: string | null
  note?: string | null
  latestAttempt: DeliveryAttempt | null
  items: { productId: number; productName: string; unit: string; lotCode: string; quantity: number }[]
}
export type AvailableOrder = {
  id: number
  orderCode: string
  recipientName: string | null
  deliveryAddress: string | null
  deliveryFailed: boolean
  redeliveryEligible: boolean
}
export type SettlementInput = {
  cashReported: number
  cashConfirmed: number
  bottlesExpected: number
  bottlesConfirmed: number
  note?: string
  /** Cọc tiền mặt tài xế báo nộp và chủ cửa hàng thực nhận. */
  depositReported?: number
  depositConfirmed?: number
}
export type DeliveryTrip = {
  id: number
  driverId: number | null
  driverName: string | null
  vehicle: string | null
  status: 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  createdAt: string
  startedAt: string | null
  endedAt: string | null
  createdBy: number
  orders: DeliveryStop[]
  settlement: (SettlementInput & { id: number; receivedBy: number; handedOverAt: string }) | null
  /** Xe trong danh mục và sức chở (kiện); null khi chuyến chỉ ghi biển số. */
  vehicleId?: number | null
  vehicleCapacity?: number | null
  /** Số kiện (bình, thùng, chai) của các đơn đang trên chuyến. */
  loadUnits?: number
}
/** `busyTripId`: chuyến đang giữ tài xế (chưa xuất phát hoặc còn đơn chưa giao xong). */
export type DeliveryDriver = { id: number; name: string; busyTripId?: number | null }
/** Xe giao hàng; sức chở tính theo kiện: mỗi bình, thùng hay chai trên đơn là một kiện. */
export type Vehicle = {
  id: number
  plate: string
  name: string | null
  capacity: number
  active: boolean
  busyTripId: number | null
}
export type VehicleInput = { plate: string; name?: string; capacity: number; active?: boolean }
export type ResultInput = { outcome: 'SUCCESS' | 'FAILED'; recipientName?: string; failureReason?: string; note?: string }
export const tripLabels = { CREATED: 'Chờ khởi hành', IN_PROGRESS: 'Đang giao', COMPLETED: 'Đã đối soát', CANCELLED: 'Đã hủy' }
const base = '/delivery/trips'
/** `orderId`: chỉ chuyến chở đơn đó (mọi lúc). `days`: chỉ chuyến chưa xong hoặc có hoạt động trong số ngày này. */
export type TripListQuery = { orderId?: number; days?: number }
/** Màn hình vận hành (bảng giao, danh sách chuyến, tài xế) xem cùng khoảng với tập đơn đang xử lý. */
export const RECENT_TRIP_DAYS = 30
export const deliveryApi = {
  dispatchAssignment: (id: number) =>
    api.post<import('@/features/live/dispatchApi').DispatchReceipt>(`/delivery/assignments/${id}/dispatch`),
  assignmentResult: (id: number, input: ResultInput) => api.post<DeliveryAttempt>(`/delivery/assignments/${id}/attempts`, input),
  assignmentAttempts: (id: number) => api.get<DeliveryAttempt[]>(`/delivery/assignments/${id}/attempts`),
  list: (query: TripListQuery = {}) => api.get<DeliveryTrip[]>(base, { params: query }),
  detail: (id: number) => api.get<DeliveryTrip>(`${base}/${id}`),
  drivers: () => api.get<DeliveryDriver[]>('/delivery/drivers'),
  vehicles: () => api.get<Vehicle[]>('/delivery/vehicles'),
  createVehicle: (input: VehicleInput) => api.post<Vehicle>('/delivery/vehicles', input),
  updateVehicle: (id: number, input: VehicleInput) => api.put<Vehicle>(`/delivery/vehicles/${id}`, input),
  available: () => api.get<AvailableOrder[]>('/delivery/available-orders'),
  create: (input: { driverId?: number; vehicle?: string; vehicleId?: number }) => api.post<DeliveryTrip>(base, input),
  assign: (id: number, driverId: number) => api.put<DeliveryTrip>(`${base}/${id}/driver`, { driverId }),
  add: (id: number, orderId: number, redelivery = false) => api.post<DeliveryStop>(`${base}/${id}/orders`, { orderId, redelivery }),
  dispatch: (id: number) => api.post<DeliveryTrip>(`${base}/${id}/dispatch`),
  remove: (id: number, orderId: number) => api.delete<DeliveryTrip>(`${base}/${id}/orders/${orderId}`),
  depart: (id: number) => api.put<DeliveryTrip>(`${base}/${id}/departure`),
  cancel: (id: number) => api.patch<DeliveryTrip>(`${base}/${id}`, { status: 'CANCELLED' }),
  result: (id: number, orderId: number, input: ResultInput) => api.post<DeliveryAttempt>(`${base}/${id}/orders/${orderId}/attempts`, input),
  attempts: (id: number, orderId: number) => api.get<DeliveryAttempt[]>(`${base}/${id}/orders/${orderId}/attempts`),
  settle: (id: number, input: SettlementInput) => api.put<DeliveryTrip>(`${base}/${id}/settlement`, input),
}
