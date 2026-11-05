// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LiveReturnsPanel } from './LiveReturnsPanel'
import { returnApi } from '@/features/live/returnApi'
vi.mock('@/features/live/returnApi', () => ({
  usePendingReturns: () => ({
    data: [
      {
        orderId: 1,
        orderCode: 'AF-1',
        recipientName: 'Customer',
        assignmentId: 3,
        attemptId: 4,
        failureReason: 'Absent',
        lines: [
          { loadItemId: 5, batchId: 6, productName: 'Water', lotCode: 'LOT-A', expiresOn: '2099-12-31', quantity: 5, sellable: null },
        ],
      },
    ],
    isError: false,
    isPending: false,
  }),
  returnApi: { list: vi.fn().mockResolvedValue([]), inspectAttempt: vi.fn() },
}))
let client: QueryClient
beforeEach(() => {
  vi.mocked(returnApi.inspectAttempt).mockReset()
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
    value: vi
      .fn()
      .mockImplementation(() => ({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
  })
  const style = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((e) => style(e))
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})
afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function open() {
  render(
    <QueryClientProvider client={client}>
      <App>
        <LiveReturnsPanel />
      </App>
    </QueryClientProvider>,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Kiểm hàng' }))
}
it('starts with no assumed receipt and disables saving an empty batch', async () => {
  await open()
  expect((screen.getByRole('button', { name: 'Lưu đợt nhận hàng' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('Còn chờ sau đợt này: 5')).toBeTruthy()
  expect(returnApi.inspectAttempt).not.toHaveBeenCalled()
})
it('submits actual received and sellable quantities, retaining missing goods as pending', async () => {
  vi.mocked(returnApi.inspectAttempt).mockResolvedValue({} as Awaited<ReturnType<typeof returnApi.inspectAttempt>>)
  await open()
  fireEvent.change(screen.getByLabelText('Thực nhận LOT-A'), { target: { value: '2' } })
  await screen.findByText('Còn chờ sau đợt này: 3')
  fireEvent.change(screen.getByLabelText('Bán lại LOT-A'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Ghi chú tình trạng'), { target: { value: 'One damaged' } })
  expect(await screen.findByText('Còn chờ sau đợt này: 3')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Lưu đợt nhận hàng' }))
  await waitFor(() => expect(returnApi.inspectAttempt).toHaveBeenCalledTimes(1))
  expect(vi.mocked(returnApi.inspectAttempt).mock.calls[0][0]).toEqual({
    attemptId: 4,
    requestId: expect.any(String),
    note: 'One damaged',
    lines: [{ loadItemId: 5, quantity: 2, sellable: 1 }],
  })
})
it('requires a damage explanation without counting the missing quantity as damaged', async () => {
  await open()
  fireEvent.change(screen.getByLabelText('Thực nhận LOT-A'), { target: { value: '2' } })
  await screen.findByText('Còn chờ sau đợt này: 3')
  fireEvent.click(screen.getByRole('button', { name: 'Lưu đợt nhận hàng' }))
  expect(await screen.findByText('Ghi rõ tình trạng hàng loại bỏ')).toBeTruthy()
  expect(returnApi.inspectAttempt).not.toHaveBeenCalled()
})
