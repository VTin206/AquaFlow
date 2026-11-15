// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import { ProductFormModal } from './ProductFormModal'

vi.mock('@/features/settings/settingsService', () => ({ useSettings: () => ({ data: { defaultLowStock: 10 } }) }))
vi.mock('../useProductCatalog', () => ({
  useSaveProduct: () => ({ mutate: vi.fn(), isPending: false }),
  useBottleTypeOptions: () => ({ types: [{ id: 1, name: 'Bình 19/20L', active: true }], isPending: false }),
  useProductCategories: () => ({ data: [] }),
}))

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })),
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('chỉ sản phẩm bán theo bình mới chọn được loại vỏ', async () => {
  render(
    <App>
      <ProductFormModal open onClose={() => {}} />
    </App>,
  )
  // Mặc định đơn vị Bình: có ô loại vỏ.
  expect(await screen.findByText('Loại vỏ')).toBeTruthy()
  // Đổi sang Thùng: ô loại vỏ biến mất.
  fireEvent.mouseDown(screen.getByLabelText('Đơn vị'))
  fireEvent.click(await screen.findByTitle('Thùng'))
  await waitFor(() => expect(screen.queryByText('Loại vỏ')).toBeNull())
})
