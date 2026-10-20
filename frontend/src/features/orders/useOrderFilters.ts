import { useEffect, useState } from 'react'
import { orderStatuses } from './orderStatus'

export const ALL_ORDERS = 'Tất cả'
export const initialOrderFilters = { query: '', status: ALL_ORDERS, method: ALL_ORDERS, payment: ALL_ORDERS }
export type OrderFilters = typeof initialOrderFilters
const STORAGE_KEY = 'aquaflow.orders.filters.v1'

export function parseOrderFilters(value: unknown): OrderFilters {
  const saved = value && typeof value === 'object' ? value as Partial<OrderFilters> : {}
  return {
    query: typeof saved.query === 'string' ? saved.query : '',
    status: typeof saved.status === 'string' && [ALL_ORDERS, ...orderStatuses].includes(saved.status) ? saved.status : ALL_ORDERS,
    method: typeof saved.method === 'string' && [ALL_ORDERS, 'Tại quầy', 'Giao tận nơi'].includes(saved.method) ? saved.method : ALL_ORDERS,
    payment: typeof saved.payment === 'string' && [ALL_ORDERS, 'Còn phải thu', 'Đã thanh toán'].includes(saved.payment) ? saved.payment : ALL_ORDERS,
  }
}

export function useOrderFilters() {
  const [filters, setFilters] = useState<OrderFilters>(() => {
    try {
      return parseOrderFilters(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null'))
    } catch {
      return initialOrderFilters
    }
  })
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
