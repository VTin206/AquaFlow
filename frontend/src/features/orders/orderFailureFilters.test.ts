import { describe, expect, it } from 'vitest'
import {
  adjustFailedStatusCounts,
  isServerPagedOrderFilter,
  matchesOrderFilters,
  orderFilterStatus,
  type OrderListFilters,
} from './orderData'
import type { Order, OrderStatus } from './types'

const all: OrderListFilters = {
  query: '',
  group: 'all',
  status: 'Tất cả',
  method: 'Tất cả',
  payment: 'Tất cả',
}

const baseOrder = {
  id: '1',
  code: 'AF-TEST01',
  customer: 'Nguyễn Lan',
  phone: '0901234567',
  items: 'Nước khoáng × 2',
  status: 'Đang giao',
  method: 'Giao tận nơi',
  total: 100000,
  payments: [],
  paymentBalance: {
    paid: 0,
    due: 100000,
    refundDue: 0,
  },
} as unknown as Order

describe('orderFilterStatus', () => {
  it.each([
    'Chờ xác nhận',
    'Đã xác nhận',
    'Đang chuẩn bị',
    'Đang giao',
  ] as const)(
    'xác định giao thất bại khi trạng thái gốc là %s',
    (status) => {
      const order = {
        ...baseOrder,
        status,
        lastAttemptFailed: true,
      }

      expect(orderFilterStatus(order)).toBe('Giao thất bại')

      // Không thay đổi trạng thái nghiệp vụ gốc.
      expect(order.status).toBe(status)
    },
  )

  it('giữ nguyên trạng thái khi không giao thất bại', () => {
    expect(
      orderFilterStatus({
        status: 'Đang giao',
        lastAttemptFailed: false,
      }),
    ).toBe('Đang giao')
  })

  it('giữ nguyên trạng thái khi không có cờ giao thất bại', () => {
    expect(
      orderFilterStatus({
        status: 'Đã xác nhận',
      }),
    ).toBe('Đã xác nhận')
  })
})

describe('failed delivery filters', () => {
  const failedOrder: Order = {
    ...baseOrder,
    lastAttemptFailed: true,
  }

  it('đưa đơn giao thất bại vào nhóm Cần xử lý', () => {
    expect(
      matchesOrderFilters(failedOrder, {
        ...all,
        group: 'need',
      }),
    ).toBe(true)
  })

  it('không đưa đơn giao thất bại vào nhóm Đang thực hiện', () => {
    expect(
      matchesOrderFilters(failedOrder, {
        ...all,
        group: 'active',
      }),
    ).toBe(false)
  })

  it('không đưa đơn đã xác nhận nhưng giao thất bại vào nhóm Đơn mới', () => {
    expect(
      matchesOrderFilters(
        {
          ...failedOrder,
          status: 'Đã xác nhận',
        },
        {
          ...all,
          group: 'new',
        },
      ),
    ).toBe(false)
  })

  it('lọc được đơn giao thất bại trong nhóm Cần xử lý', () => {
    expect(
      matchesOrderFilters(failedOrder, {
        ...all,
        group: 'need',
        status: 'Giao thất bại',
      }),
    ).toBe(true)
  })

  it('lọc được đơn giao thất bại trong nhóm Tất cả', () => {
    expect(
      matchesOrderFilters(failedOrder, {
        ...all,
        status: 'Giao thất bại',
      }),
    ).toBe(true)
  })

  it('không tính đơn giao thất bại vào bộ lọc Đang giao', () => {
    expect(
      matchesOrderFilters(failedOrder, {
        ...all,
        status: 'Đang giao',
      }),
    ).toBe(false)
  })

  it('đơn đang giao bình thường vẫn thuộc nhóm Đang thực hiện', () => {
    expect(
      matchesOrderFilters(
        {
          ...baseOrder,
          lastAttemptFailed: false,
        },
        {
          ...all,
          group: 'active',
        },
      ),
    ).toBe(true)
  })

  it('đơn đang giao bình thường không thuộc nhóm Cần xử lý', () => {
    expect(
      matchesOrderFilters(
        {
          ...baseOrder,
          lastAttemptFailed: false,
        },
        {
          ...all,
          group: 'need',
        },
      ),
    ).toBe(false)
  })

  it('đơn giao thất bại vẫn xuất hiện trong nhóm Tất cả', () => {
    expect(matchesOrderFilters(failedOrder, all)).toBe(true)
  })

  it('kết hợp lọc giao thất bại với tìm kiếm', () => {
    expect(
      matchesOrderFilters(failedOrder, {
        ...all,
        status: 'Giao thất bại',
        query: 'nguyen lan',
      }),
    ).toBe(true)

    expect(
      matchesOrderFilters(failedOrder, {
        ...all,
        status: 'Giao thất bại',
        query: 'khong ton tai',
      }),
    ).toBe(false)
  })

  it('kết hợp lọc giao thất bại với hình thức nhận', () => {
    expect(
      matchesOrderFilters(failedOrder, {
        ...all,
        status: 'Giao thất bại',
        method: 'Giao tận nơi',
      }),
    ).toBe(true)

    expect(
      matchesOrderFilters(failedOrder, {
        ...all,
        status: 'Giao thất bại',
        method: 'Tại quầy',
      }),
    ).toBe(false)
  })

  it('kết hợp lọc giao thất bại với thanh toán', () => {
    expect(
      matchesOrderFilters(failedOrder, {
        ...all,
        status: 'Giao thất bại',
        payment: 'Còn phải thu',
      }),
    ).toBe(true)

    expect(
      matchesOrderFilters(failedOrder, {
        ...all,
        status: 'Giao thất bại',
        payment: 'Đã thanh toán',
      }),
    ).toBe(false)
  })
})

describe('failed delivery pagination', () => {
  it.each([
    'Chờ xác nhận',
    'Đã xác nhận',
    'Đang chuẩn bị',
    'Đang giao',
    'Giao thất bại',
  ])(
    'sử dụng working-set khi lọc %s trong nhóm Tất cả',
    (status) => {
      expect(
        isServerPagedOrderFilter({
          ...all,
          status,
        }),
      ).toBe(false)
    },
  )

  it.each([
    'Tất cả',
    'Đã giao',
    'Đã hoàn tất',
    'Đã hủy',
  ])(
    'giữ phân trang backend khi lọc %s trong nhóm Tất cả',
    (status) => {
      expect(
        isServerPagedOrderFilter({
          ...all,
          status,
        }),
      ).toBe(true)
    },
  )

  it.each(['new', 'need', 'active'] as const)(
    'giữ lọc tại trình duyệt cho nhóm %s',
    (group) => {
      expect(
        isServerPagedOrderFilter({
          ...all,
          group,
        }),
      ).toBe(false)
    },
  )

  it('giữ phân trang backend cho nhóm Đã xong', () => {
    expect(
      isServerPagedOrderFilter({
        ...all,
        group: 'done',
      }),
    ).toBe(true)
  })
})

describe('adjustFailedStatusCounts', () => {
  const counts: Partial<Record<OrderStatus, number>> = {
    'Chờ xác nhận': 1,
    'Đã xác nhận': 2,
    'Đang chuẩn bị': 2,
    'Đang giao': 3,
    'Đã giao': 1,
    'Đã hoàn tất': 1,
    'Đã hủy': 1,
  }

  it('chuyển số đơn giao thất bại khỏi trạng thái gốc', () => {
    const result = adjustFailedStatusCounts(counts, [
      {
        status: 'Đang giao',
        lastAttemptFailed: true,
      },
    ])

    expect(result['Đang giao']).toBe(2)
    expect(result['Giao thất bại']).toBe(1)
  })

  it('xử lý nhiều đơn giao thất bại ở các trạng thái khác nhau', () => {
    const result = adjustFailedStatusCounts(counts, [
      {
        status: 'Đang giao',
        lastAttemptFailed: true,
      },
      {
        status: 'Đang giao',
        lastAttemptFailed: true,
      },
      {
        status: 'Đã xác nhận',
        lastAttemptFailed: true,
      },
      {
        status: 'Đang chuẩn bị',
        lastAttemptFailed: true,
      },
    ])

    expect(result['Đang giao']).toBe(1)
    expect(result['Đã xác nhận']).toBe(1)
    expect(result['Đang chuẩn bị']).toBe(1)
    expect(result['Giao thất bại']).toBe(4)
  })

  it('không thay đổi tổng số đơn hàng', () => {
    const result = adjustFailedStatusCounts(counts, [
      {
        status: 'Đang giao',
        lastAttemptFailed: true,
      },
      {
        status: 'Đang chuẩn bị',
        lastAttemptFailed: true,
      },
    ])

    const totalBefore = Object.values(counts).reduce(
      (sum, count) => sum + count,
      0,
    )

    const totalAfter = Object.values(result).reduce(
      (sum, count) => sum + count,
      0,
    )

    expect(totalAfter).toBe(totalBefore)
  })

  it('không thay đổi số lượng của các đơn không giao thất bại', () => {
    const result = adjustFailedStatusCounts(counts, [
      {
        status: 'Đang giao',
        lastAttemptFailed: false,
      },
      {
        status: 'Đã xác nhận',
      },
    ])

    expect(result).toEqual({
      ...counts,
      'Giao thất bại': 0,
    })
  })

  it('không chỉnh sửa trực tiếp dữ liệu số lượng ban đầu', () => {
    const original = { ...counts }

    adjustFailedStatusCounts(counts, [
      {
        status: 'Đang giao',
        lastAttemptFailed: true,
      },
    ])

    expect(counts).toEqual(original)
  })

  it('không tạo số lượng âm khi dữ liệu hai request lệch tạm thời', () => {
    const result = adjustFailedStatusCounts(
      {
        'Đang giao': 1,
      },
      [
        {
          status: 'Đang giao',
          lastAttemptFailed: true,
        },
        {
          status: 'Đang giao',
          lastAttemptFailed: true,
        },
      ],
    )

    expect(result['Đang giao']).toBe(0)
    expect(result['Giao thất bại']).toBe(1)
  })

  it('không thay đổi số lượng đơn đã giao, hoàn tất và hủy', () => {
    const result = adjustFailedStatusCounts(counts, [
      {
        status: 'Đang giao',
        lastAttemptFailed: true,
      },
    ])

    expect(result['Đã giao']).toBe(counts['Đã giao'])
    expect(result['Đã hoàn tất']).toBe(counts['Đã hoàn tất'])
    expect(result['Đã hủy']).toBe(counts['Đã hủy'])
  })
})
