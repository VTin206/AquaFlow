import { api } from '../../shared/api/client'

export type BottleType = { id: number; name: string; depositUnitAmount: number; active: boolean }
export type BottleTypeDraft = Pick<BottleType, 'name' | 'depositUnitAmount'>

export const bottleTypeApi = {
  list: (active?: boolean) => api.get<BottleType[]>(`/bottle-types${active === undefined ? '' : `?active=${active}`}`),
  create: (draft: BottleTypeDraft) => api.post<BottleType>('/bottle-types', { name: draft.name.trim(), depositUnitAmount: draft.depositUnitAmount }),
  update: (id: number, depositUnitAmount: number) => api.put<BottleType>(`/bottle-types/${id}`, { depositUnitAmount }),
  deactivate: (id: number) => api.delete<void>(`/bottle-types/${id}`),
}
