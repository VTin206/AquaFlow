import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { orderStatuses } from './orderStatus'

export const ALL_ORDERS = 'Tất cả'
export const initialOrderFilters = { query: '', status: ALL_ORDERS, method: ALL_ORDERS, payment: ALL_ORDERS }
export type OrderFilters = typeof initialOrderFilters
const STORAGE_KEY = 'aquaflow.orders.filters.v1'

export function parseOrderFilters(value: unknown): OrderFilters {
  const saved = value && typeof value === 'object' ? (value as Partial<OrderFilters>) : {}
  return {
    query: typeof saved.query === 'string' ? saved.query : '',
    status: typeof saved.status === 'string' && [ALL_ORDERS, ...orderStatuses].includes(saved.status) ? saved.status : ALL_ORDERS,
    method: typeof saved.method === 'string' && [ALL_ORDERS, 'Tại quầy', 'Giao tận nơi'].includes(saved.method) ? saved.method : ALL_ORDERS,
    payment:
      typeof saved.payment === 'string' && [ALL_ORDERS, 'Còn phải thu', 'Đã thanh toán'].includes(saved.payment)
        ? saved.payment
        : ALL_ORDERS,
  }
}

/** Link mở trang Đơn hàng với bộ lọc sẵn, ví dụ từ Tổng quan. */
export const ordersLink = (filters: Partial<Pick<OrderFilters, 'status' | 'payment'>>) => `/orders?${new URLSearchParams(filters)}`

export function useOrderFilters() {
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState<OrderFilters>(() => {
    // Đi từ link có bộ lọc thì chỉ lọc theo link, để số đơn khớp với chỗ vừa bấm.
    if (params.has('status') || params.has('payment')) {
      return parseOrderFilters({ status: params.get('status'), payment: params.get('payment') })
    }
    try {
      return parseOrderFilters(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null'))
    } catch {
      return initialOrderFilters
    }
  })
  // Bộ lọc đã nhận vào state; bỏ khỏi URL để tải lại trang không đè lựa chọn mới của người dùng.
  useEffect(() => {
    if (params.has('status') || params.has('payment')) setParams({}, { replace: true })
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
