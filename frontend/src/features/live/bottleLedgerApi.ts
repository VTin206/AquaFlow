import { api } from '@/shared/api/client'
import { pageParams, type Page, type PageQuery } from '@/shared/api/page'

export type BottleBalance = {
  customerId: number
  name: string
  active: boolean
  bottlesHeld: number
  depositHeld: number
  requiredDeposit: number
  refundable: number
}
export type BottleTypeBalance = { bottleTypeId: number; name: string; active: boolean; held: number; unitAmount: number; liability: number }
export type BottleLedgerEntry = {
  id: string
  kind: string
  bottleType: string | null
  bottles: number
  deposit: number
  note: string | null
  actor: string
  at: string
}
export type BottleLedger = { balance: BottleBalance; types: BottleTypeBalance[]; entries: BottleLedgerEntry[] }
export type BottleInput = {
  requestId: string
  kind: 'GIVE' | 'RECEIVE' | 'LOSS' | 'COLLECT' | 'REFUND'
  bottleTypeId?: number
  quantity?: number
  amount?: number
  note?: string
}
export const bottleLedgerApi = {
  /** Sổ vỏ theo khách (kể cả hồ sơ đã lưu trữ), khách mới nhất trước. */
  balances: (query: PageQuery) => api.get<Page<BottleBalance>>('/sales/bottle-balances', { params: pageParams(query) }),
  ledger: (id: number) => api.get<BottleLedger>(`/sales/customers/${id}/bottle-ledger`),
  create: (id: number, input: BottleInput) => api.post<BottleLedgerEntry>(`/sales/customers/${id}/bottle-transactions`, input),
}
