// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { App, Grid } from 'antd'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import type { Order } from '../types'
import { OrderCards } from './OrderCards'
import { OrdersTable } from './OrdersTable'

vi.mock('./OrderNextAction', () => ({
  OrderNextAction: () => null,
}))

vi.mock('./OrderBulkActions', () => ({
  OrderBulkActions: () => null,
}))

vi.mock('./OrderDetails', () => ({
  OrderDetails: () => null,
}))

const baseOrder: Order = {
  id: '12',
  code: 'AF-TEST12',
  customer: 'Khách Test',
  phone: '0901234567',
  address: 'TP. Hồ Chí Minh',
  items: 'Nước uống × 2',
  total: 100000,
  time: '09:00',
  status: 'Đang giao',
  method: 'Giao tận nơi',
  channel: 'Website',
  lines: [],
  deliveryFee: 0,
  payments: [],
  history: [
    {
      at: '2026-11-20T01:00:00Z',
      message: 'Tạo đơn',
    },
  ],
  stockReserved: false,
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() { }
      unobserve() { }
      disconnect() { }
    },
  )

  const getStyle = window.getComputedStyle.bind(window)

  vi.spyOn(window, 'getComputedStyle').mockImplementation(
    (element) => getStyle(element),
  )

  vi.spyOn(Grid, 'useBreakpoint').mockReturnValue({
    xs: false,
    sm: true,
    md: true,
    lg: true,
    xl: true,
    xxl: false,
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderOrder(
  layout: 'desktop' | 'mobile',
  overrides: Partial<Order> = {},
) {
  const order: Order = {
    ...baseOrder,
    ...overrides,
  }

  return render(
    <App>
      <MemoryRouter>
        {layout === 'desktop' ? (
          <OrdersTable orders={[order]} />
        ) : (
          <OrderCards
            orders={[order]}
            compact={false}
            emptyText="Chưa có đơn hàng nào."
            onDetails={vi.fn()}
          />
        )}
      </MemoryRouter>
    </App>,
  )
}

describe.each(['desktop', 'mobile'] as const)(
  'Cảnh báo giao thất bại trên %s',
  (layout) => {
    it('hiển thị cảnh báo khi lần giao gần nhất thất bại', () => {
      renderOrder(layout, {
        status: 'Đang giao',
        lastAttemptFailed: true,
      })

      expect(
        screen.getByText('Đang giao'),
      ).toBeTruthy()

      expect(
        screen.getByText('Giao thất bại'),
      ).toBeTruthy()
    })

    it('không hiển thị cảnh báo khi lần giao không thất bại', () => {
      renderOrder(layout, {
        status: 'Đang giao',
        lastAttemptFailed: false,
      })

      expect(
        screen.getByText('Đang giao'),
      ).toBeTruthy()

      expect(
        screen.queryByText('Giao thất bại'),
      ).toBeNull()
    })

    it('không hiển thị cảnh báo khi không có cờ thất bại', () => {
      renderOrder(layout, {
        status: 'Đang giao',
        lastAttemptFailed: undefined,
      })

      expect(
        screen.getByText('Đang giao'),
      ).toBeTruthy()

      expect(
        screen.queryByText('Giao thất bại'),
      ).toBeNull()
    })

    it('không hiển thị trùng nhãn giao thất bại', () => {
      renderOrder(layout, {
        status: 'Giao thất bại',
        lastAttemptFailed: true,
      })

      expect(
        screen.getAllByText('Giao thất bại'),
      ).toHaveLength(1)
    })

    it('giữ nguyên trạng thái chuẩn bị khi có cảnh báo giao thất bại', () => {
      renderOrder(layout, {
        status: 'Đang chuẩn bị',
        lastAttemptFailed: true,
      })

      expect(
        screen.getByText('Đang chuẩn bị'),
      ).toBeTruthy()

      expect(
        screen.getByText('Giao thất bại'),
      ).toBeTruthy()
    })
  },
)
