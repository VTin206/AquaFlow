import { customers, initialOrders, initialProducts } from './data'

// "Database" trong bộ nhớ cho chế độ dữ liệu mẫu. Mất dữ liệu khi tải lại trang.
export const db = {
  orders: structuredClone(initialOrders),
  products: structuredClone(initialProducts),
  customers: structuredClone(customers),
}
