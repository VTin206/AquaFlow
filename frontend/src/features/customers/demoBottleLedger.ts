import type { BottleInput, BottleLedger } from '@/features/live/bottleLedgerApi'
import { DEPOSIT_PER_BOTTLE } from '@/shared/policy'
import { customerService } from './customerService'
import type { BottleAction, BottleEntryKind } from './types'

// Chuyển sổ vỏ mẫu sang đúng kiểu của API để bản dùng thử và tài khoản thật dùng chung một màn hình.

/** Nghiệp vụ không có ở API giữ nguyên tên, màn hình hiện thẳng. */
const entryKinds: Record<BottleEntryKind, string> = {
  'Số dư đầu kỳ': 'Số dư đầu kỳ',
  'Giao kèm đơn': 'GIVE',
  'Thu vỏ': 'RECEIVE',
  'Phí thu hồi': 'Phí thu hồi',
  'Báo mất/vỡ': 'LOSS',
  'Thu cọc': 'COLLECT',
  'Hoàn cọc': 'REFUND',
}

const actions: Partial<Record<BottleInput['kind'], BottleAction['kind']>> = {
  RECEIVE: 'Thu vỏ',
  LOSS: 'Báo mất/vỡ',
  COLLECT: 'Thu cọc',
  REFUND: 'Hoàn cọc',
}

export const demoBottleApi = {
  ledger: async (customerId: string): Promise<BottleLedger> => {
    const [customers, entries] = await Promise.all([customerService.list(), customerService.ledger(customerId)])
    const customer = customers.find((item) => item.id === customerId)
    if (!customer) throw new Error('Không tìm thấy khách hàng.')
    const requiredDeposit = customer.bottlesHeld * DEPOSIT_PER_BOTTLE
    return {
      balance: {
        customerId: 0,
        name: customer.name,
        active: true,
        bottlesHeld: customer.bottlesHeld,
        depositHeld: customer.depositHeld,
        requiredDeposit,
        refundable: Math.max(0, customer.depositHeld - requiredDeposit),
      },
      types: [
        { bottleTypeId: 1, name: 'Vỏ bình 19L', active: true, held: customer.bottlesHeld, unitAmount: DEPOSIT_PER_BOTTLE, liability: requiredDeposit },
      ],
      entries: entries.map((entry) => ({
        id: entry.id,
        kind: entryKinds[entry.kind],
        bottleType: null,
        bottles: entry.bottles,
        deposit: entry.deposit,
        note: entry.orderId ?? entry.note ?? null,
        actor: entry.by ?? '—',
        at: entry.at,
      })),
    }
  },
  create: async (customerId: string, input: BottleInput) => {
    const kind = actions[input.kind]
    if (!kind) throw new Error('Giao vỏ chưa hỗ trợ ở bản dùng thử.')
    await customerService.recordBottles(customerId, { kind, bottles: input.quantity, deposit: input.amount, note: input.note })
  },
}
