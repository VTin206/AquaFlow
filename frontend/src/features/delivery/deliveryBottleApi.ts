import { api } from '@/shared/api/client'

export type DeliveryBottles = {
  tracked: boolean
  linkedCustomer: boolean
  given: boolean
  canReturn: boolean
  lines: { bottleTypeId: number; name: string; given: number; returned: number; unitDeposit: number }[]
  receipts: { requestId: string; typeName: string; quantity: number; actor: string; at: string }[]
}
export type BottleReturnInput = { requestId: string; lines: { bottleTypeId: number; quantity: number }[] }
export const deliveryBottleApi = {
  get: (id: number) => api.get<DeliveryBottles>(`/delivery/assignments/${id}/bottles`),
  receive: (id: number, input: BottleReturnInput) => api.post<DeliveryBottles>(`/delivery/assignments/${id}/bottle-returns`, input),
}
