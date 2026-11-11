import { mockError, mockRequest } from '@/mocks/mockRequest'
import { DEPOSIT_PER_BOTTLE } from '@/shared/policy'
import type { BottleType, BottleTypeDraft } from './bottleTypeApi'

// Dữ liệu mẫu đúng kiểu của API để bản dùng thử và tài khoản thật dùng chung danh mục loại vỏ.
let types: BottleType[] = [
  { id: 1, name: 'Vỏ bình 20L', depositUnitAmount: DEPOSIT_PER_BOTTLE, active: true },
  { id: 2, name: 'Vỏ bình 10L', depositUnitAmount: 30_000, active: false },
]

const change = (id: number, patch: Partial<BottleType>) => {
  const current = types.find((type) => type.id === id)
  if (!current) throw mockError(404, 'Không tìm thấy loại vỏ.')
  const updated = { ...current, ...patch }
  types = types.map((type) => (type.id === id ? updated : type))
  return updated
}

export const demoBottleTypeApi = {
  list: (active?: boolean) => mockRequest(() => types.filter((type) => active === undefined || type.active === active)),
  create: (draft: BottleTypeDraft) =>
    mockRequest(() => {
      const name = draft.name.trim()
      if (types.some((type) => type.name.toLowerCase() === name.toLowerCase())) throw mockError(400, 'Loại vỏ này đã có.')
      const created: BottleType = {
        id: Math.max(0, ...types.map((type) => type.id)) + 1,
        name,
        depositUnitAmount: draft.depositUnitAmount,
        active: true,
      }
      types = [...types, created]
      return created
    }),
  update: (id: number, depositUnitAmount: number) => mockRequest(() => change(id, { depositUnitAmount })),
  deactivate: (id: number) =>
    mockRequest(() => {
      change(id, { active: false })
    }),
  reactivate: (id: number) => mockRequest(() => change(id, { active: true })),
}
