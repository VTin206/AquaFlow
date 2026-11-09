// @vitest-environment jsdom
import { expect, test } from 'vitest'
import { demoReceiptDrafts } from './demoReceiptDrafts'
import { receiptToForm } from './useInventory'

test('phiếu nháp lưu, sửa và hủy được mà không mất dữ liệu', async () => {
  const [seed] = await demoReceiptDrafts.list()
  expect(seed.status).toBe('DRAFT')

  const created = await demoReceiptDrafts.save(receiptToForm(seed))
  expect(created.id).not.toBe(seed.id)
  expect(created.total).toBe(seed.total)

  const edited = await demoReceiptDrafts.save({ ...receiptToForm(created), note: 'Đã sửa' }, created.id)
  expect(edited.id).toBe(created.id)
  expect(edited.note).toBe('Đã sửa')

  const cancelled = await demoReceiptDrafts.cancel(created.id)
  expect(cancelled.status).toBe('CANCELLED')
  expect((await demoReceiptDrafts.list()).filter((draft) => draft.id === created.id)).toHaveLength(1)
})
