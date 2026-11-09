// @vitest-environment jsdom
import { expect, test } from 'vitest'
import { db } from '@/mocks/db'
import { demoAddressApi } from './demoAddressApi'

const draft = { recipientName: 'Người nhận', recipientPhone: '0901234567', addressLine: 'Địa chỉ mới', area: null }

test('luôn có đúng một địa chỉ mặc định và hồ sơ khách cập nhật theo', async () => {
  const customer = db.customers.find((item) => item.addresses.length > 0)!
  const api = demoAddressApi(customer.id)
  const before = await api.list()

  const created = await api.create({ ...draft, isDefault: true })
  let rows = await api.list()
  expect(rows).toHaveLength(before.length + 1)
  expect(rows.filter((row) => row.isDefault).map((row) => row.id)).toEqual([created.id])
  expect(customer.addresses[0]).toBe('Địa chỉ mới')

  await api.remove(created.id)
  rows = await api.list()
  expect(rows).toHaveLength(before.length)
  expect(rows.filter((row) => row.isDefault)).toHaveLength(1)
})
