import { mockError, mockRequest } from '@/mocks/mockRequest'
import { db } from '@/mocks/db'
import type { Address, AddressDraft } from '@/features/live/LiveCustomerAddresses'

// Sổ địa chỉ mẫu đúng kiểu của API để bản dùng thử và tài khoản thật dùng chung một màn hình.
const store = new Map<string, Address[]>()
let nextId = 1

const recordOf = (customerId: string) => {
  const record = db.customers.find((customer) => customer.id === customerId)
  if (!record) throw mockError(404, 'Không tìm thấy khách hàng.')
  return record
}

const rowsOf = (customerId: string) => {
  const existing = store.get(customerId)
  if (existing) return existing
  const record = recordOf(customerId)
  const rows = record.addresses.map((addressLine, index) => ({
    id: nextId++,
    customerId: 0,
    recipientName: record.name,
    recipientPhone: record.phone,
    addressLine,
    area: record.area ?? null,
    isDefault: index === 0,
  }))
  store.set(customerId, rows)
  return rows
}

/** Luôn có một địa chỉ mặc định, và hồ sơ khách hiện địa chỉ mặc định trước. */
const commit = (customerId: string, rows: Address[], defaultId?: number) => {
  const chosen = defaultId ?? rows.find((row) => row.isDefault)?.id ?? rows[0]?.id
  const next = rows.map((row) => ({ ...row, isDefault: row.id === chosen }))
  store.set(customerId, next)
  recordOf(customerId).addresses = [...next].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)).map((row) => row.addressLine)
}

export const demoAddressApi = (customerId: string) => ({
  list: () => mockRequest(() => rowsOf(customerId)),
  create: (input: AddressDraft) =>
    mockRequest(() => {
      const created: Address = { ...input, id: nextId++, customerId: 0 }
      commit(customerId, [...rowsOf(customerId), created], input.isDefault ? created.id : undefined)
      return created
    }),
  update: (id: number, input: AddressDraft) =>
    mockRequest(() => {
      const rows = rowsOf(customerId)
      if (!rows.some((row) => row.id === id)) throw mockError(404, 'Không tìm thấy địa chỉ.')
      commit(
        customerId,
        rows.map((row) => (row.id === id ? { ...row, ...input } : row)),
        input.isDefault ? id : undefined,
      )
      return { ...input, id, customerId: 0 }
    }),
  remove: (id: number) =>
    mockRequest(() => {
      commit(
        customerId,
        rowsOf(customerId).filter((row) => row.id !== id),
      )
    }),
})
