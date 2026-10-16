import { bottleLedger, customers, dailyRevenue, initialOrders, initialProducts } from './data'
import { initialLots, initialReceipts } from './inventory'
import { initialSuppliers } from './suppliers'
import { initialTrips } from './trips'

// "Database" trong bộ nhớ cho chế độ dữ liệu mẫu. Mất dữ liệu khi tải lại trang.
export const db = {
  orders: structuredClone(initialOrders),
  products: structuredClone(initialProducts),
  customers: structuredClone(customers),
  bottleLedger: structuredClone(bottleLedger),
  suppliers: structuredClone(initialSuppliers),
  lots: structuredClone(initialLots),
  receipts: structuredClone(initialReceipts),
  trips: structuredClone(initialTrips),
  dailyRevenue: structuredClone(dailyRevenue),
}
