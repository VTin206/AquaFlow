import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { groupOfStatus, isOrderGroup, type OrderGroupKey } from './orderGroups'
import { orderStatuses } from './orderStatus'

export const ALL_ORDERS = 'Tất cả'
/** `group` rỗng: chưa chọn nhóm, trang tự mở "Cần xử lý" nếu có đơn, không thì "Tất cả". */
export const initialOrderFilters: OrderFilters = { query: '', group: '', status: ALL_ORDERS, method: ALL_ORDERS, payment: ALL_ORDERS }
export type OrderFilters = { query: string; group: OrderGroupKey | ''; status: string; method: string; payment: string }
const STORAGE_KEY = 'aquaflow.orders.filters.v1'

export function parseOrderFilters(value: unknown): OrderFilters {
  const saved = value && typeof value === 'object' ? (value as Partial<OrderFilters>) : {}
  const status = typeof saved.status === 'string' && [ALL_ORDERS, ...orderStatuses].includes(saved.status) ? saved.status : ALL_ORDERS
  return {
    query: typeof saved.query === 'string' ? saved.query : '',
    // Bộ lọc lưu từ trước khi có nhóm, hoặc liên kết chỉ có trạng thái: chọn nhóm chứa trạng thái đó.
    group: isOrderGroup(saved.group) ? saved.group : status === ALL_ORDERS ? '' : groupOfStatus(status),
    status,
    method: typeof saved.method === 'string' && [ALL_ORDERS, 'Tại quầy', 'Giao tận nơi'].includes(saved.method) ? saved.method : ALL_ORDERS,
    payment:
      typeof saved.payment === 'string' && [ALL_ORDERS, 'Còn phải thu', 'Đã thanh toán'].includes(saved.payment)
        ? saved.payment
        : ALL_ORDERS,
  }
}

/** Link mở trang Đơn hàng với bộ lọc sẵn, ví dụ từ Tổng quan. */
export const ordersLink = (filters: Partial<Pick<OrderFilters, 'group' | 'status' | 'payment'>>) => `/orders?${new URLSearchParams(filters)}`

export function useOrderFilters() {
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState<OrderFilters>(() => {
    // Đi từ link có bộ lọc thì chỉ lọc theo link, để số đơn khớp với chỗ vừa bấm.
    if (params.has('status') || params.has('payment')) {
      const linked = parseOrderFilters({ group: params.get('group'), status: params.get('status'), payment: params.get('payment') })
      // Liên kết chỉ lọc thanh toán mà không nói nhóm thì xem trên tất cả đơn, không tự mở "Cần xử lý".
      return linked.group ? linked : { ...linked, group: 'all' }
    }
    try {
      return parseOrderFilters(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null'))
    } catch {
      return initialOrderFilters
    }
  })
  // Bộ lọc đã nhận vào state; bỏ khỏi URL để tải lại trang không đè lựa chọn mới của người dùng.
  useEffect(() => {
    if (params.has('status') || params.has('payment') || params.has('group')) setParams({}, { replace: true })
  }, [params, setParams])
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // Trình duyệt chặn lưu trữ: bộ lọc vẫn hoạt động trong trang hiện tại.
    }
  }, [filters])

  return {
    filters,
    updateFilters: (change: Partial<OrderFilters>) => setFilters((previous) => ({ ...previous, ...change })),
    resetFilters: () => setFilters(initialOrderFilters),
  }
}
